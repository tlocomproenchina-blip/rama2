import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { decodeBarcodeFromUrl } from '../../shared/barcodeDecode.ts';
import { applyScanCapture, notifyWholesalerReception } from '../../shared/bodegaScanProcess.ts';

// Procesa las capturas que quedaron en la cola del almacén de China.
//
// Cada captura se toma con un arriendo (lease): mientras un worker la tiene, otro
// no la puede procesar, y si el trabajo queda a medias el arriendo vence y la
// captura vuelve sola a la cola. El resultado principal (la carga registrada) se
// guarda antes de los avisos al mayorista, y un fallo recuperable deja la captura
// de nuevo en cola para el siguiente intento.
//
// Acciones:
//   run (por defecto) → procesa capturas pendientes (todas, o las de job_ids)
//   status            → estado de unas capturas (para la pantalla del escáner)
//   retry             → devuelve capturas con error a la cola
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'run');
    const jobIds = Array.isArray(body.job_ids)
      ? body.job_ids.map((id: any) => String(id || '').trim()).filter(Boolean)
      : [];

    if (action === 'status') {
      return Response.json({ jobs: await readJobs(base44, body, jobIds) });
    }

    if (action === 'retry') {
      if (!jobIds.length) return Response.json({ error: 'job_ids requerido' }, { status: 400 });
      await base44.asServiceRole.entities.BodegaScanJob.updateMany(
        { id: { $in: jobIds }, status: { $ne: 'procesando' } },
        { $set: { status: 'pendiente', attempts: 0, error_message: null, lease_id: null, lease_until: null } },
      );
      return Response.json({ ok: true, requeued: jobIds.length });
    }

    await recoverStaleJobs(base44);

    const startedAt = Date.now();
    const leaseId = crypto.randomUUID();
    const jobs = await claimJobs(base44, {
      jobIds,
      limit: Math.min(Number(body.limit) || MAX_JOBS, MAX_JOBS),
      leaseId,
    });

    const results: any[] = [];
    for (let i = 0; i < jobs.length; i++) {
      // Presupuesto de tiempo: lo que no se alcance a procesar queda pendiente y
      // lo toma el siguiente worker (o el corte automático cada 5 minutos).
      if (i > 0 && Date.now() - startedAt > BUDGET_MS) break;
      results.push(await processJob(base44, jobs[i]));
    }

    return Response.json({ processed: results.length, results });
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}

const MAX_ATTEMPTS = 4;
const LEASE_MS = 120000;
const BUDGET_MS = 45000;
const MAX_JOBS = 6;

// Capturas que quedaron tomadas por un worker que no terminó (pantalla cerrada,
// función cortada): vuelven a la cola para que nadie se quede sin registrar.
async function recoverStaleJobs(base44: any) {
  try {
    await base44.asServiceRole.entities.BodegaScanJob.updateMany(
      { status: 'procesando', lease_until: { $lt: new Date().toISOString() } },
      { $set: { status: 'pendiente', lease_id: null, lease_until: null } },
    );
  } catch (_) {}
}

// Toma las capturas pendientes y las marca como propias releyéndolas después del
// arriendo: si otro worker se adelantó, no se procesan dos veces.
async function claimJobs(base44: any, { jobIds, limit, leaseId }: { jobIds: string[]; limit: number; leaseId: string }) {
  const query = jobIds.length
    ? { id: { $in: jobIds }, status: 'pendiente' }
    : { status: 'pendiente' };

  const rows = await base44.asServiceRole.entities.BodegaScanJob.filter(query, 'queued_date', limit);
  const claimed: any[] = [];
  const now = new Date();

  for (const row of rows || []) {
    await base44.asServiceRole.entities.BodegaScanJob.updateMany(
      { id: row.id, status: 'pendiente' },
      {
        $set: {
          status: 'procesando',
          lease_id: leaseId,
          lease_until: new Date(now.getTime() + LEASE_MS).toISOString(),
          started_date: now.toISOString(),
        },
      },
    );
    const fresh = await base44.asServiceRole.entities.BodegaScanJob.filter({ id: row.id }, '-created_date', 1);
    if (fresh?.[0]?.lease_id === leaseId) claimed.push(fresh[0]);
  }

  return claimed;
}

async function processJob(base44: any, job: any) {
  const startedAt = Date.now();
  const receivedBy = `Bodega China (${job.device_id})`;

  try {
    // 1) Lectura del código en el servidor, sobre la foto capturada.
    const barcode = job.photo_url ? await decodeBarcodeFromUrl(job.photo_url) : null;

    // 2) Registro de la carga: coincidencia con el envío, lectura confiable que no
    //    encuentra titular (huérfano) o, cuando no hay ningún tracking legible,
    //    captura pendiente de identificar sin registrar nada.
    const outcome = await applyScanCapture(base44, {
      scanner: barcode ? { code: barcode.code, reliable: barcode.reliable } : null,
      hint: job.hint_tracking || '',
      photoUrl: job.photo_url || null,
      receivedBy,
      // Captura registrada a propósito sin foto: el operador decidió dar la carga de
      // alta igual, aunque no haya código que leer.
      allowUntrackedOrphan: !job.photo_url,
    });

    const pending = outcome.result_type === 'pendiente';

    const patch: Record<string, any> = {
      status: pending ? 'sin_identificar' : 'procesado',
      lease_id: null,
      lease_until: null,
      tracking_number: outcome.tracking_number || '',
      shipping_mark: outcome.shipping_mark || '',
      package_id: outcome.package_id || null,
      process_ms: Date.now() - startedAt,
    };
    if (pending) {
      // La captura no registró nada: espera a que alguien la revise o la vuelva a
      // escanear, así que no se le pone fecha de cierre.
      patch.error_message = 'No se pudo leer el código: pendiente de identificar';
      if (outcome.reason) patch.description = `Lectura con visión sin resultado: ${String(outcome.reason).slice(0, 300)}`;
    } else {
      patch.result_type = outcome.result_type;
      patch.detection_source = outcome.detection || 'manual';
      patch.error_message = null;
      patch.finished_date = new Date().toISOString();
    }
    await base44.asServiceRole.entities.BodegaScanJob.update(job.id, patch);

    // Tareas posteriores: la carga ya quedó registrada, así que no pueden dejar el
    // trabajo a medias ni bloquear las siguientes capturas. Una captura pendiente de
    // identificar no registró nada: no se anota en el historial del almacén.
    if (!pending) await logScan(base44, job, outcome);
    if (outcome.wholesaler_pkg) {
      await notifyWholesalerReception(
        base44,
        outcome.wholesaler_pkg,
        job.photo_url || null,
        new Date().toISOString(),
        `recibido en almacén por ${receivedBy}`,
      );
    }

    return {
      job_id: job.id,
      result_type: outcome.result_type,
      tracking_number: outcome.tracking_number,
      shipping_mark: outcome.shipping_mark,
    };
  } catch (error: any) {
    const attempts = (Number(job.attempts) || 0) + 1;
    const gaveUp = attempts >= MAX_ATTEMPTS;
    await base44.asServiceRole.entities.BodegaScanJob.update(job.id, {
      status: gaveUp ? 'error' : 'pendiente',
      attempts,
      lease_id: null,
      lease_until: null,
      error_message: String(error?.message || error).slice(0, 500),
      ...(gaveUp ? { finished_date: new Date().toISOString() } : {}),
    });
    return { job_id: job.id, error: String(error?.message || error) };
  }
}

// Registro de productividad del escaneo y actividad del dispositivo: es el mismo
// historial que alimenta los paneles de bodega.
async function logScan(base44: any, job: any, outcome: any) {
  const now = new Date().toISOString();

  try {
    await base44.asServiceRole.entities.EscaneoBodega.create({
      device_id: job.device_id,
      tracking_number: outcome.tracking_number || '(foto sin tracking)',
      shipping_mark: outcome.shipping_mark || '',
      photo_url: job.photo_url || null,
      result_type: outcome.result_type,
    });
  } catch (_) {}

  try {
    const devices = await base44.asServiceRole.entities.DispositivoBodega.filter(
      { device_id: job.device_id }, '-created_date', 1
    );
    if (devices?.[0]) {
      await base44.asServiceRole.entities.DispositivoBodega.update(devices[0].id, {
        last_activity: now,
        total_scans: (devices[0].total_scans || 0) + 1,
      });
    }
  } catch (_) {}
}

function jobSummary(job: any) {
  return {
    id: job.id,
    status: job.status,
    result_type: job.result_type || null,
    detection_source: job.detection_source || null,
    tracking_number: job.tracking_number || '',
    shipping_mark: job.shipping_mark || '',
    photo_url: job.photo_url || null,
    package_id: job.package_id || null,
    error_message: job.error_message || null,
    attempts: Number(job.attempts) || 0,
    queued_date: job.queued_date || job.created_date || null,
  };
}

async function readJobs(base44: any, body: any, jobIds: string[]) {
  if (jobIds.length) {
    const rows = await base44.asServiceRole.entities.BodegaScanJob.filter(
      { id: { $in: jobIds } }, '-created_date', Math.min(jobIds.length, 30)
    );
    return (rows || []).map(jobSummary);
  }

  const deviceId = String(body.device_id || '').trim();
  if (!deviceId) return [];

  const rows = await base44.asServiceRole.entities.BodegaScanJob.filter(
    { device_id: deviceId }, '-queued_date', Math.min(Number(body.limit) || 10, 30)
  );
  return (rows || []).map(jobSummary);
}