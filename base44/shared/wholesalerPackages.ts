// Operaciones sobre paquetes para la app del mayorista: consultar un tracking,
// marcarlo como recibido en el almacén de China y registrar pre-alertas reportadas.
// Nunca crea paquetes al consultar/recepcionar y nunca degrada un estado.
import { logWholesalerEvent, updateWholesalerConfig, truncate } from './wholesalerCore.ts';

const SOURCE_LABEL = 'App del mayorista';
const MAX_TRACKINGS_PER_CALL = 50;

export function cleanTracking(value: any) {
  return String(value || '').trim().replace(/\s+/g, '');
}

// El escáner suele leer el sub-tracking (master + sufijo de caja), así que se
// prueban variantes quitando dígitos del final.
export function buildTrackingCandidates(tracking: string) {
  const removalOrder = [0, 3, 2, 4, 1, 5, 6];
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const remove of removalOrder) {
    if (remove === 0) {
      if (!seen.has(tracking)) {
        seen.add(tracking);
        candidates.push(tracking);
      }
      continue;
    }
    if (tracking.length - remove < 5) continue;
    const candidate = tracking.slice(0, tracking.length - remove);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      candidates.push(candidate);
    }
  }
  return candidates;
}

export async function findPackageByTracking(base44: any, tracking: string) {
  const clean = cleanTracking(tracking);
  if (!clean) return null;

  for (const candidate of buildTrackingCandidates(clean)) {
    const matches = await base44.asServiceRole.entities.Package.filter({ tracking_number: candidate }, '-created_date', 1);
    if (matches?.[0]) return matches[0];
  }

  const byLabel = await base44.asServiceRole.entities.Package.filter({ label_code: clean }, '-created_date', 1);
  return byLabel?.[0] || null;
}

function describePackage(pkg: any) {
  return {
    huerfano: pkg?.is_orphan === true,
    estado: pkg?.status || null,
    shipping_mark: pkg?.shipping_mark || '',
    package_id: pkg?.id || null,
  };
}

// Solo lectura: dice si el tracking está registrado, sin modificar nada.
export async function checkTracking(base44: any, tracking: string) {
  const clean = cleanTracking(tracking);
  if (!clean) {
    return { ok: false, tracking: '', resultado: 'error', registrado: false, mensaje: 'Falta el tracking a consultar.' };
  }

  const pkg = await findPackageByTracking(base44, clean);
  const base = { ok: true, tracking: clean };

  if (!pkg) {
    await logWholesalerEvent(base44, {
      event_type: 'consulta',
      tracking_number: clean,
      result: 'no_registrado',
      detail: 'Consulta de solo lectura: el tracking no está registrado',
    });
    return { ...base, resultado: 'no_registrado', registrado: false, huerfano: false, estado: null, shipping_mark: '', mensaje: 'El tracking no está registrado en TLEC CARGO.' };
  }

  await logWholesalerEvent(base44, {
    event_type: 'consulta',
    tracking_number: clean,
    client_email: pkg.client_email || '',
    shipping_mark: pkg.shipping_mark || '',
    package_id: pkg.id,
    result: pkg.status || 'registrado',
    detail: 'Consulta de solo lectura',
  });

  return {
    ...base,
    resultado: 'registrado',
    registrado: true,
    ...describePackage(pkg),
    mensaje: pkg.is_orphan === true
      ? 'Está registrado como huérfano (todavía sin cliente asignado).'
      : 'Está registrado en TLEC CARGO.',
  };
}

// Marca el tracking como recibido en el almacén de China (idempotente).
export async function receiveTracking(base44: any, tracking: string) {
  const clean = cleanTracking(tracking);
  const now = new Date().toISOString();

  if (!clean) {
    return { tracking: '', resultado: 'error', mensaje: 'Falta el tracking: no se modificó nada.' };
  }

  const pkg = await findPackageByTracking(base44, clean);
  if (!pkg) {
    await logWholesalerEvent(base44, {
      event_type: 'no_registrado',
      tracking_number: clean,
      result: 'no_registrado',
      detail: 'El tracking no está registrado: no se creó nada',
    });
    return { tracking: clean, resultado: 'no_registrado', estado: null, huerfano: false, shipping_mark: '', mensaje: 'El tracking no está registrado en TLEC CARGO: no se creó nada.' };
  }

  const pendingReception = pkg.status === 'pre_alerta' || (pkg.is_orphan === true && !pkg.received_date);

  if (!pendingReception) {
    await logWholesalerEvent(base44, {
      event_type: 'recepcion_existente',
      tracking_number: clean,
      client_email: pkg.client_email || '',
      shipping_mark: pkg.shipping_mark || '',
      package_id: pkg.id,
      result: pkg.status || 'ya_registrado',
      detail: 'Ya estaba registrado: no se modificó ni se devolvió de estado',
    });
    return {
      tracking: clean,
      resultado: 'ya_registrado',
      ...describePackage(pkg),
      mensaje: `Ya estaba registrado con estado "${pkg.status}": no se modificó nada.`,
    };
  }

  const updated = await base44.asServiceRole.entities.Package.update(pkg.id, {
    status: 'recibido',
    received_date: now,
    received_by: SOURCE_LABEL,
  });

  const log = await logWholesalerEvent(base44, {
    event_type: 'recepcion',
    tracking_number: clean,
    client_email: updated?.client_email || pkg.client_email || '',
    shipping_mark: updated?.shipping_mark || pkg.shipping_mark || '',
    package_id: pkg.id,
    result: 'recibido',
    detail: 'Recepcionado desde la app del mayorista',
    notify_pending: true,
  });

  await updateWholesalerConfig(base44, {
    last_reception_date: now,
    last_reception_tracking: clean,
    last_reception_status: 'recibido',
  });

  return {
    tracking: clean,
    resultado: 'recibido',
    estado: 'recibido',
    huerfano: (updated?.is_orphan ?? pkg.is_orphan) === true,
    shipping_mark: updated?.shipping_mark || pkg.shipping_mark || '',
    package_id: pkg.id,
    fecha: now,
    log_id: log?.id || null,
    mensaje: 'Marcado como recibido en el almacén de China.',
  };
}

// Recepción de un bloque de trackings (una sola llamada de la app del mayorista).
export async function receiveTrackingBlock(base44: any, trackings: any) {
  const list = Array.isArray(trackings) ? trackings : [trackings];
  const clean = Array.from(new Set(list.map(cleanTracking).filter(Boolean))).slice(0, MAX_TRACKINGS_PER_CALL);

  const resultados: any[] = [];
  for (const tracking of clean) {
    try {
      resultados.push(await receiveTracking(base44, tracking));
    } catch (err: any) {
      resultados.push({ tracking, resultado: 'error', mensaje: truncate(err?.message || 'No se pudo procesar el tracking.', 300) });
    }
  }

  const recibidos = resultados.filter((r) => r.resultado === 'recibido');
  const yaRegistrados = resultados.filter((r) => r.resultado === 'ya_registrado');
  const noRegistrados = resultados.filter((r) => r.resultado === 'no_registrado');

  return { resultados, recibidos, yaRegistrados, noRegistrados };
}

// Registra una pre-alerta reportada por la app del mayorista a nombre de su cliente.
export async function reportPrealert(base44: any, payload: any) {
  const tracking = cleanTracking(payload?.tracking);
  const labelCode = String(payload?.label_code || '').trim();
  const clientEmail = String(payload?.client_email || '').trim().toLowerCase();
  const shippingMark = String(payload?.shipping_mark || '').trim();
  const shippingType = payload?.shipping_type === 'aereo' ? 'aereo' : 'maritimo';
  const riskCategory = payload?.risk_category === 'alto_riesgo' ? 'alto_riesgo' : 'general';
  const packageCount = Math.max(1, Number(payload?.package_count) || 1);
  const description = truncate(payload?.description || 'Pre-alerta reportada por el cliente mayorista', 500);

  if (!tracking && !labelCode) {
    return { ok: false, resultado: 'error', mensaje: 'Falta el tracking o el código de etiqueta.' };
  }

  let client = null;
  if (clientEmail) {
    const rows = await base44.asServiceRole.entities.User.filter({ email: clientEmail }, '-created_date', 1);
    client = rows?.[0] || null;
  }
  if (!client && shippingMark) {
    const rows = await base44.asServiceRole.entities.User.filter({ shipping_mark: shippingMark }, '-created_date', 1);
    client = rows?.[0] || null;
  }

  if (!client) {
    await logWholesalerEvent(base44, {
      event_type: 'prealerta_rechazada',
      tracking_number: tracking || labelCode,
      client_email: clientEmail,
      shipping_mark: shippingMark,
      result: 'cliente_no_encontrado',
      detail: 'El cliente indicado no existe en TLEC CARGO',
    });
    return {
      ok: false,
      resultado: 'cliente_no_encontrado',
      mensaje: 'Ese cliente no existe en TLEC CARGO: la pre-alerta no se registró. Verifica el correo o el shipping mark.',
    };
  }

  let existing = null;
  if (tracking) {
    const rows = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking }, '-created_date', 1);
    existing = rows?.[0] || null;
  }
  if (!existing && labelCode) {
    const rows = await base44.asServiceRole.entities.Package.filter({ label_code: labelCode }, '-created_date', 1);
    existing = rows?.[0] || null;
  }

  if (existing) {
    await logWholesalerEvent(base44, {
      event_type: 'prealerta_duplicada',
      tracking_number: tracking || labelCode,
      client_email: existing.client_email || clientEmail,
      shipping_mark: existing.shipping_mark || '',
      package_id: existing.id,
      result: existing.status || 'duplicado',
      detail: 'Ese tracking ya estaba registrado: no se tocó',
    });
    return { ok: false, resultado: 'duplicado', mensaje: 'Ese tracking ya estaba registrado en TLEC CARGO: no se tocó nada.' };
  }

  const created = await base44.asServiceRole.entities.Package.create({
    tracking_number: tracking || '',
    client_email: client.email,
    shipping_mark: client.shipping_mark || shippingMark,
    ...(labelCode ? { label_code: labelCode } : {}),
    shipping_type: shippingType,
    risk_category: riskCategory,
    package_count: packageCount,
    description,
    status: 'pre_alerta',
    is_orphan: false,
    reception_notes: 'Pre-alerta reportada por el cliente mayorista (app externa)',
  });

  await logWholesalerEvent(base44, {
    event_type: 'prealerta_reportada',
    tracking_number: tracking || labelCode,
    client_email: client.email,
    shipping_mark: created?.shipping_mark || '',
    package_id: created?.id || null,
    result: 'pre_alerta',
    detail: 'Pre-alerta registrada desde la app del mayorista',
  });

  return {
    ok: true,
    resultado: 'registrada',
    package_id: created?.id || null,
    shipping_mark: created?.shipping_mark || '',
    mensaje: 'Pre-alerta registrada en TLEC CARGO.',
  };
}