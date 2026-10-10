// Lógica compartida de las guías de despacho: correlativo dedicado
// (DispatchGuideCounter con bloqueo optimista), búsqueda de la guía abierta de un
// cliente, alta y actualización del contenido de la guía, y marcado de los
// escaneos incluidos para que dejen de ofrecerse como pendientes.
// La usan la emisión manual (createDispatchGuide) y la automática que dispara el
// escaneo de un bulto en Despacho por Escaneo (attachScanToDispatchGuide).

const COUNTER_KEY = 'main';
const MAX_ATTEMPTS = 6;
const APPEND_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const normCode = (raw: any) => String(raw || '').trim().toUpperCase();
export const unique = (list: any[]) => [...new Set((list || []).filter(Boolean))];

// El bloque que se despacha termina en -B## (bulto suelto) o en -C## (caja
// consolidada con etiqueta continua); su prefijo es el shipping mark del cliente.
export const isBultoCode = (code: any) => /-[BC]\d+$/i.test(String(code || '').trim());

export const markOfCode = (code: any) => {
  const match = String(code || '').trim().match(/^(.*?)-[BC]\d+$/i);
  return match ? match[1].trim().toUpperCase() : '';
};

// Conteo real del bulto: el conteo corregido por el almacén manda; si no está, se
// usa la cantidad de paquetes asociados y, por último, sus trackings.
export const packageCountOfBulto = (bulto: any) => {
  if (!bulto) return 0;
  const cargo = Number(bulto.cargo_package_count);
  if (Number.isFinite(cargo) && cargo > 0) return cargo;
  const ids = Array.isArray(bulto.package_ids) ? bulto.package_ids.filter(Boolean) : [];
  if (ids.length) return ids.length;
  const trackings = Array.isArray(bulto.package_trackings) ? bulto.package_trackings.filter(Boolean) : [];
  return trackings.length;
};

export const nextGuideNumber = (sequence: number) => `GD-${String(sequence).padStart(5, '0')}`;

// Número correlativo de la guía: bloqueo optimista sobre el contador dedicado.
export async function allocateGuideSequence(base44: any): Promise<number | null> {
  let sequence: number | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && sequence === null; attempt += 1) {
    const rows = await base44.asServiceRole.entities.DispatchGuideCounter
      .filter({ config_key: COUNTER_KEY }, '-updated_date', 1)
      .catch(() => []);
    let counter: any = rows?.[0] || null;

    if (!counter) {
      try {
        counter = await base44.asServiceRole.entities.DispatchGuideCounter.create({
          config_key: COUNTER_KEY,
          last_number: 0,
        });
      } catch (_) {
        await sleep(80);
        continue;
      }
    }

    const oldValue = Number(counter.last_number) || 0;
    const result: any = await base44.asServiceRole.entities.DispatchGuideCounter.updateMany(
      { config_key: COUNTER_KEY, last_number: oldValue },
      { $inc: { last_number: 1 } }
    );

    if (result?.updated >= 1) sequence = oldValue + 1;
    else await sleep(60);
  }
  return sequence;
}

// Marca los escaneos de esos bultos con la guía: salen de la lista de pendientes y
// no vuelven a ofrecerse para una guía nueva.
export async function markScansWithGuide(
  base44: any,
  { codes, guideId, guideNumber, emittedDate }: any
): Promise<boolean> {
  const list = unique((codes || []).map((code: any) => normCode(code)).filter(Boolean));
  if (!list.length || !guideId) return false;
  try {
    let remaining = true;
    let guard = 0;
    while (remaining && guard < 20) {
      guard += 1;
      const result: any = await base44.asServiceRole.entities.DispatchScanLog.updateMany(
        {
          // Los escaneos sin guía quedan con guide_id vacío (null o ausente): se
          // marcan solo esos, nunca uno que ya pertenezca a otra guía.
          $and: [
            { $or: [{ bulto_label_code: { $in: list } }, { scanned_code: { $in: list } }] },
            { guide_id: null },
          ],
        },
        { $set: { guide_id: guideId, guide_number: guideNumber, guide_emitted_date: emittedDate } }
      );
      remaining = !!result?.has_more;
    }
    return true;
  } catch (_) {
    return false;
  }
}

// Suelta los escaneos de esos bultos: vuelven a ofrecerse como pendientes cuando un
// bulto se quita de la guía desde el historial.
export async function releaseScansFromGuide(base44: any, { codes, guideId }: any): Promise<boolean> {
  const list = unique((codes || []).map((code: any) => normCode(code)).filter(Boolean));
  if (!list.length || !guideId) return false;
  try {
    let remaining = true;
    let guard = 0;
    while (remaining && guard < 20) {
      guard += 1;
      const result: any = await base44.asServiceRole.entities.DispatchScanLog.updateMany(
        {
          $and: [
            { $or: [{ bulto_label_code: { $in: list } }, { scanned_code: { $in: list } }] },
            { guide_id: guideId },
          ],
        },
        { $set: { guide_id: null, guide_number: '', guide_emitted_date: null } }
      );
      remaining = !!result?.has_more;
    }
    return true;
  } catch (_) {
    return false;
  }
}

export const recomputeGuideTotals = (clients: any[]) => {
  const list = Array.isArray(clients) ? clients : [];
  const rows = list.flatMap((c: any) => c.bultos || []);
  return {
    clients: list.length,
    bultos: rows.length,
    packages: rows.reduce((sum: number, b: any) => sum + (Number(b.package_count) || 0), 0),
    // Líneas de carga sin bulto registrado (emitidas por su N° de orden / envío).
    unregistered: rows.filter((b: any) => b?.unregistered || !b?.label_code).length,
    cajas: rows.filter((b: any) => b?.is_caja).length,
    cbm: Number(rows.reduce((sum: number, b: any) => sum + (Number(b.cbm) || 0), 0).toFixed(4)),
  };
};

// Guía abierta del cliente: la que sigue emitida (sin entrega anotada). Se busca
// por email y, cuando el escaneo no lo trae, por shipping mark.
export async function findOpenGuide(base44: any, { email, mark }: any) {
  const filters: any[] = [];
  const cleanEmail = String(email || '').trim();
  if (cleanEmail) filters.push({ client_emails: cleanEmail });
  if (mark) filters.push({ shipping_marks: normCode(mark) });
  if (!filters.length) return null;

  for (const extra of filters) {
    const rows = await base44.asServiceRole.entities.DispatchGuide
      .filter({ dispatch_status: 'emitida', ...extra }, '-created_date', 1)
      .catch(() => []);
    if (rows?.[0]) return rows[0];
  }
  return null;
}

const buildClientGroup = ({ clientEmail, profile, bulto, mark, clientName, bultoRow }: any) => {
  const snapshot = bulto?.client_snapshot || {};
  const client = {
    full_name: snapshot.full_name || profile?.full_name || clientName || '',
    email: clientEmail || snapshot.email || '',
    cedula: snapshot.cedula || profile?.cedula || '',
    whatsapp: snapshot.whatsapp || profile?.whatsapp || '',
    address: snapshot.address || profile?.address || '',
    city: snapshot.city || profile?.city || '',
    state: snapshot.state || profile?.state || '',
    shipping_mark: mark || snapshot.shipping_mark || profile?.shipping_mark || '',
  };

  return {
    client_key: clientEmail ? clientEmail.toLowerCase() : `unknown:${mark || 'sin-mark'}`,
    client_email: clientEmail || '',
    client_name: client.full_name || clientEmail || `Cliente — ${mark || 'sin mark'}`,
    shipping_mark: client.shipping_mark || '',
    orders_count: 0,
    client,
    bultos: [bultoRow],
    totals: {
      bultos: 1,
      packages: Number(bultoRow.package_count) || 0,
      scanned: 1,
      cajas: bultoRow.is_caja ? 1 : 0,
      cbm: Number(bultoRow.cbm) || 0,
    },
  };
};

// Suma el bulto a la guía abierta. Relee la guía antes de guardar y verifica que
// el código haya quedado dentro: si dos escáneres coinciden, ninguno se pierde ni
// se repite.
async function appendBultoToGuide(base44: any, guideRef: any, clientGroup: any, bultoRow: any, code: string, scannedAt: string, scannedBy: string) {
  let current: any = guideRef;
  for (let attempt = 0; attempt < APPEND_ATTEMPTS; attempt += 1) {
    const fresh = await base44.asServiceRole.entities.DispatchGuide.get(guideRef.id).catch(() => null);
    if (fresh) current = fresh;

    const clients = Array.isArray(current.clients)
      ? current.clients.map((c: any) => ({ ...c, bultos: [...(c.bultos || [])] }))
      : [];

    const already = clients.some((c: any) => (c.bultos || []).some((b: any) => normCode(b?.label_code) === code));
    if (already) return { guide: current, already: true };

    const emailKey = String(clientGroup.client_email || '').toLowerCase();
    const markKey = String(clientGroup.shipping_mark || '').toUpperCase();
    const index = clients.findIndex((c: any) => {
      if (emailKey) return String(c.client_email || '').toLowerCase() === emailKey;
      return markKey && String(c.shipping_mark || '').toUpperCase() === markKey;
    });

    if (index >= 0) {
      const target: any = clients[index];
      target.bultos = [...(target.bultos || []), bultoRow].sort((a: any, b: any) =>
        String(a.label_code).localeCompare(String(b.label_code))
      );
      target.totals = {
        bultos: target.bultos.length,
        packages: target.bultos.reduce((sum: number, b: any) => sum + (Number(b.package_count) || 0), 0),
        scanned: (Number(target.totals?.scanned) || 0) + 1,
        cajas: target.bultos.filter((b: any) => b?.is_caja).length,
        cbm: Number(
          target.bultos.reduce((sum: number, b: any) => sum + (Number(b.cbm) || 0), 0).toFixed(4)
        ),
      };
      if (!target.client_email && clientGroup.client_email) target.client_email = clientGroup.client_email;
      if (!target.client_name && clientGroup.client_name) target.client_name = clientGroup.client_name;
      if (!target.shipping_mark && clientGroup.shipping_mark) target.shipping_mark = clientGroup.shipping_mark;
      if (!target.client || !Object.keys(target.client).length) target.client = clientGroup.client;
    } else {
      clients.push(clientGroup);
    }

    await base44.asServiceRole.entities.DispatchGuide.update(current.id, {
      clients,
      client_names: unique([...(current.client_names || []), ...clients.map((c: any) => c.client_name)]),
      client_emails: unique([...(current.client_emails || []), ...clients.map((c: any) => c.client_email)]),
      shipping_marks: unique([...(current.shipping_marks || []), ...clients.map((c: any) => c.shipping_mark)]),
      bulto_codes: unique([...(current.bulto_codes || []), code]),
      totals: recomputeGuideTotals(clients),
      last_updated_date: scannedAt,
      last_updated_by: scannedBy,
    }).catch(() => null);

    const saved = await base44.asServiceRole.entities.DispatchGuide.get(current.id).catch(() => null);
    if (saved) {
      current = saved;
      if ((saved.bulto_codes || []).some((c: any) => normCode(c) === code)) return { guide: saved, already: false };
    }
  }
  return { guide: current, already: false };
}

// Escaneo de un bulto ya despachado: arma o completa la guía de su cliente. Si no
// hay guía abierta se crea una nueva con el siguiente correlativo, usando la fecha
// real del escaneo (que se conserva aunque el escaneo se suba después).
export async function appendScanToDispatchGuide(base44: any, entry: any) {
  const code = normCode(entry?.label_code || entry?.scanned_code);
  if (!isBultoCode(code)) return { skipped: 'no_es_bulto' };

  const scannedAt = entry?.scanned_at || new Date().toISOString();
  const scannedBy = String(entry?.scanned_by || '').trim();
  const scannedByName = String(entry?.scanned_by_name || '').trim();

  const bultoRows = await base44.asServiceRole.entities.Bulto
    .filter({ label_code: code }, '-created_date', 1)
    .catch(() => []);
  let bulto: any = bultoRows?.[0] || null;

  let mark = normCode(entry?.shipping_mark) || normCode(bulto?.shipping_mark) || markOfCode(code);
  let clientEmail = String(entry?.client_email || bulto?.client_email || '').trim();
  let profile: any = null;

  if (clientEmail) {
    const users = await base44.asServiceRole.entities.User.filter({ email: clientEmail }, undefined, 1).catch(() => []);
    profile = users?.[0] || null;
  }

  if (!clientEmail && mark) {
    const byMark = await base44.asServiceRole.entities.User
      .filter({ shipping_mark: mark }, undefined, 2)
      .catch(() => []);
    profile = byMark?.[0] || null;
    if (profile?.email) clientEmail = String(profile.email).trim();
  }

  if (!clientEmail && mark) {
    const byMarkBulto = await base44.asServiceRole.entities.Bulto
      .filter({ shipping_mark: mark, client_email: { $exists: true, $ne: '' } }, '-created_date', 5)
      .catch(() => []);
    const owner = (byMarkBulto || []).find((b: any) => b?.client_email);
    if (owner) {
      clientEmail = String(owner.client_email).trim();
      bulto = bulto || owner;
    }
  }

  if (!mark) mark = normCode(profile?.shipping_mark) || markOfCode(code);
  if (!clientEmail && !mark) return { skipped: 'sin_cliente' };

  const packageCount = packageCountOfBulto(bulto) || Number(entry?.package_count) || 0;
  // La línea de la guía guarda si el bloque es una caja consolidada y su posición X/N,
  // tal como quedó impresa en la etiqueta continua, más su CBM.
  const bultoRow = {
    label_code: code,
    package_count: packageCount,
    registered: !!bulto,
    date: scannedAt,
    order_number: '',
    scans: 1,
    is_caja: !!bulto?.is_caja,
    caja_number: Number(bulto?.caja_number) || 0,
    caja_total: Number(bulto?.caja_total) || 0,
    cbm: Number(bulto?.cargo_cbm) || 0,
  };

  const clientGroup = buildClientGroup({
    clientEmail,
    profile,
    bulto,
    mark,
    clientName: entry?.client_name || '',
    bultoRow,
  });

  let guide: any = await findOpenGuide(base44, { email: clientEmail, mark });
  let created = false;
  let already = false;

  if (guide) {
    const appended = await appendBultoToGuide(base44, guide, clientGroup, bultoRow, code, scannedAt, scannedBy);
    guide = appended.guide;
    already = appended.already;
  } else {
    const sequence = await allocateGuideSequence(base44);
    if (sequence === null) return { error: 'No se pudo asignar el número de guía' };

    // Segunda comprobación: si otro escáner abrió la guía del cliente justo antes,
    // este bulto se suma a esa guía en lugar de abrir una paralela.
    const opened = await findOpenGuide(base44, { email: clientEmail, mark });
    if (opened) {
      const appended = await appendBultoToGuide(base44, opened, clientGroup, bultoRow, code, scannedAt, scannedBy);
      guide = appended.guide;
      already = appended.already;
    } else {
      const guideNumber = nextGuideNumber(sequence);
      if (!mark) mark = clientGroup.shipping_mark || markOfCode(code);
      guide = await base44.asServiceRole.entities.DispatchGuide.create({
        guide_number: guideNumber,
        guide_sequence: sequence,
        emitted_date: scannedAt,
        emitted_by: scannedBy,
        emitted_by_name: scannedByName,
        clients: [clientGroup],
        client_names: unique([clientGroup.client_name]),
        client_emails: unique([clientGroup.client_email]),
        shipping_marks: unique([clientGroup.shipping_mark]),
        bulto_codes: [code],
        totals: recomputeGuideTotals([clientGroup]),
        dispatch_status: 'emitida',
        auto_generated: true,
        last_updated_date: scannedAt,
        last_updated_by: scannedBy,
      });
      created = true;
    }
  }

  await markScansWithGuide(base44, {
    codes: [code],
    guideId: guide.id,
    guideNumber: guide.guide_number,
    emittedDate: guide.emitted_date,
  });

  return {
    ok: true,
    created,
    already,
    guide_id: guide.id,
    guide_number: guide.guide_number,
    bultos_count: (guide.bulto_codes || []).length,
  };
}