import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Cola compartida de impresiones Bluetooth. El backend no habla con la impresora:
// coordina los trabajos para que un solo teléfono (la estación) los imprima uno a uno.
const ALIVE_MS = 60_000; // la estación late cada 20 s
const CLAIM_MS = 120_000; // tiempo máximo de una impresión reservada
const MAX_RETRIES = 5;

const isAlive = (s: any) =>
  !!(s?.device_id && s.heartbeat_at && Date.now() - new Date(s.heartbeat_at).getTime() < ALIVE_MS);

const publicStation = (s: any) => (s ? {
  device_id: s.device_id || '',
  operator_email: s.operator_email || '',
  operator_name: s.operator_name || '',
  heartbeat_at: s.heartbeat_at || null,
  alive: isAlive(s),
} : { device_id: '', alive: false });

const slim = (j: any) => {
  if (!j) return null;
  const { claim_token, payload_uri, ...rest } = j;
  return rest;
};

// Personal: administradores y empleados de cualquier área (todos con role 'admin';
// el área va en custom_role). Los clientes (role 'user') no usan la cola.
const isStaff = (user: any) => user?.role === 'admin';

const toBase64 = (buf: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isStaff(user)) return Response.json({ error: 'Solo el personal puede usar la cola de impresión' }, { status: 403 });

    const svc = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const deviceId = String(body.device_id || '').trim();
    const nowIso = new Date().toISOString();

    const loadStation = async () => (await svc.PrintStation.filter({ station_key: 'main' }, '-updated_date', 1))[0] || null;
    const getJob = (id: string) => svc.PrintJob.get(id).catch((e: any) => (e?.status === 404 ? null : Promise.reject(e)));

    // Reservas vencidas (estación que dejó de responder): pasan a fallidas para que un
    // operador decida reintentar; no se reimprimen solas por si la etiqueta ya salió.
    const recoverStale = async () => {
      const printing = await svc.PrintJob.filter({ status: 'printing' }, 'created_date', 20);
      const stale = printing.filter((j: any) => !j.claim_expires_at || new Date(j.claim_expires_at).getTime() < Date.now());
      await Promise.allSettled(stale.map((j: any) => svc.PrintJob.update(j.id, {
        status: 'failed',
        claim_token: '',
        error: 'La estación dejó de responder durante la impresión. Revisa si salió la etiqueta antes de reintentar.',
      })));
    };

    if (action === 'station') {
      return Response.json({ station: publicStation(await loadStation()) });
    }

    if (action === 'state') {
      await recoverStale();
      const [station, jobs] = await Promise.all([loadStation(), svc.PrintJob.list('-created_date', 25)]);
      return Response.json({ station: publicStation(station), jobs: jobs.map(slim) });
    }

    if (action === 'heartbeat') {
      if (!deviceId) return Response.json({ error: 'Falta el dispositivo' }, { status: 400 });
      const s = await loadStation();
      const data = {
        device_id: deviceId,
        operator_email: user.email,
        operator_name: user.full_name || user.email,
        heartbeat_at: nowIso,
      };
      let saved;
      if (!s) {
        saved = await svc.PrintStation.create({ station_key: 'main', ...data, started_at: nowIso });
      } else if (s.device_id === deviceId) {
        saved = await svc.PrintStation.update(s.id, data);
      } else if (!isAlive(s) || body.force) {
        saved = await svc.PrintStation.update(s.id, { ...data, started_at: nowIso });
      } else {
        return Response.json({ ok: false, station: publicStation(s) });
      }
      return Response.json({ ok: true, station: publicStation({ ...s, ...saved, ...data }) });
    }

    if (action === 'release') {
      const s = await loadStation();
      if (s && s.device_id === deviceId) await svc.PrintStation.update(s.id, { device_id: '', heartbeat_at: null });
      return Response.json({ ok: true });
    }

    if (action === 'enqueue') {
      const clientKey = String(body.client_key || '').trim();
      const payloadUri = String(body.payload_uri || '').trim();
      if (!clientKey || !payloadUri) return Response.json({ error: 'Faltan los datos de impresión' }, { status: 400 });
      // Mismo trabajo aún en espera o imprimiéndose: se devuelve en vez de duplicarlo.
      const existing = (await svc.PrintJob.filter({ client_key: clientKey, status: { $in: ['pending', 'printing'] } }, '-created_date', 1))[0];
      if (existing) return Response.json({ job: slim(existing), duplicate: true });
      const job = await svc.PrintJob.create({
        title: String(body.title || 'Etiquetas').slice(0, 160),
        source: String(body.source || '').slice(0, 60),
        label_count: Number(body.label_count) || 0,
        payload_uri: payloadUri,
        payload_size: Number(body.payload_size) || 0,
        status: 'pending',
        client_key: clientKey,
        requested_by: user.email,
        requested_by_name: user.full_name || user.email,
        requester_device: deviceId,
        attempts: 0,
      });
      return Response.json({ job: slim(job) });
    }

    if (action === 'claim') {
      const s = await loadStation();
      if (!s || s.device_id !== deviceId) return Response.json({ error: 'not_station' }, { status: 409 });
      await recoverStale();
      const next = (await svc.PrintJob.filter({ status: 'pending' }, 'created_date', 1))[0];
      if (!next) return Response.json({ job: null });
      const token = crypto.randomUUID();
      await svc.PrintJob.update(next.id, {
        status: 'printing',
        claim_token: token,
        claimed_at: nowIso,
        claim_expires_at: new Date(Date.now() + CLAIM_MS).toISOString(),
        station_device: deviceId,
        station_operator: user.email,
        error: '',
      });
      const check = await getJob(next.id);
      if (!check || check.claim_token !== token) return Response.json({ job: null, retry: true });
      let payload = '';
      try {
        const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: next.payload_uri, expires_in: 300 });
        const url = signed?.signed_url || signed?.data?.signed_url;
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        payload = toBase64(new Uint8Array(await res.arrayBuffer()));
      } catch (e) {
        await svc.PrintJob.update(next.id, { status: 'failed', claim_token: '', error: 'No se pudieron leer los datos de impresión' });
        return Response.json({ job: null, retry: true });
      }
      return Response.json({ job: { ...slim(check), claim_token: token }, payload_b64: payload });
    }

    if (action === 'complete' || action === 'fail') {
      const job = await getJob(String(body.job_id || ''));
      if (!job) return Response.json({ error: 'Trabajo no encontrado' }, { status: 404 });
      if (job.status !== 'printing' || job.claim_token !== body.claim_token) {
        return Response.json({ error: 'La reserva de este trabajo ya no es válida' }, { status: 409 });
      }
      const patch = action === 'complete'
        ? { status: 'done', printed_at: nowIso, claim_token: '', error: '' }
        : { status: 'failed', claim_token: '', error: String(body.error || 'Error de impresión').slice(0, 300) };
      await svc.PrintJob.update(job.id, patch);
      return Response.json({ ok: true });
    }

    if (action === 'retry') {
      const job = await getJob(String(body.job_id || ''));
      if (!job) return Response.json({ error: 'Trabajo no encontrado' }, { status: 404 });
      if (job.status !== 'failed') return Response.json({ error: 'Solo se reintentan trabajos fallidos' }, { status: 409 });
      if ((job.attempts || 0) >= MAX_RETRIES) {
        return Response.json({ error: `Este trabajo ya se reintentó ${MAX_RETRIES} veces. Envíalo de nuevo desde su pantalla.` }, { status: 409 });
      }
      await svc.PrintJob.update(job.id, {
        status: 'pending', error: '', claim_token: '', station_device: '', attempts: (job.attempts || 0) + 1,
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}