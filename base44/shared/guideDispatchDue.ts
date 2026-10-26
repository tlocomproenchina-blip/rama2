// Regla de despacho automático de las guías:
// toda guía emitida se marca despachada (sus bultos y los contenedores que salieron
// en ella) al llegar el sábado inmediato posterior a su emisión, contando ese sábado
// como alcanzado (sábado inclusive) en hora de Caracas.
// Una guía emitida el lunes 26/10 tiene como límite el sábado 31/10; una emitida el
// sábado 24/10 pasa al sábado siguiente, 31/10.

export const CARACAS_TZ = 'America/Caracas';

const NO_ORDER_LABELS = ['SIN N° DE ORDEN', 'SIN N° DE CONTENEDOR'];

// Clave de fecha (YYYY-MM-DD) en hora de Caracas.
export const caracasDateKey = (value: any = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CARACAS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

// Sábado inmediato DESPUÉS de la fecha de emisión (si se emitió en sábado, el
// siguiente sábado).
export const nextSaturdayDateKey = (emitted: any) => {
  const base = caracasDateKey(emitted);
  if (!base) return '';
  const [year, month, day] = base.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = domingo
  const ahead = (6 - weekday + 7) % 7 || 7;
  return new Date(Date.UTC(year, month - 1, day + ahead)).toISOString().slice(0, 10);
};

// Sábado inclusive: el límite ya se alcanzó desde el inicio del sábado en Caracas.
export const isDispatchDueReached = (dueDate: any, now: any = new Date()) => {
  const due = String(dueDate || '').trim();
  if (!due) return false;
  return caracasDateKey(now) >= due;
};

export const isOrderNumberValue = (raw: any) => {
  const text = String(raw || '').trim();
  if (!text) return false;
  return !NO_ORDER_LABELS.includes(text.toUpperCase());
};

// Contenedores (N° de orden/envío de CbmIngreso) que salieron en la guía, agrupados
// por cliente: líneas con bulto registrado, carga sin bulto y las claves guardadas
// de esa carga (email#contenedor).
export const containersOfGuide = (guide: any) => {
  const byEmail = new Map<string, { email: string; orders: Set<string> }>();
  const keyOf = (email: any) => String(email || '').trim().toLowerCase();
  const ensure = (email: any) => {
    const clean = String(email || '').trim();
    const key = keyOf(clean);
    if (!key) return null;
    if (!byEmail.has(key)) byEmail.set(key, { email: clean, orders: new Set() });
    return byEmail.get(key) as { email: string; orders: Set<string> };
  };

  (guide?.clients || []).forEach((client: any) => {
    const bucket = ensure(client?.client_email);
    if (!bucket) return;
    (client?.bultos || []).forEach((line: any) => {
      const order = String(line?.order_number || '').trim();
      if (isOrderNumberValue(order)) bucket.orders.add(order);
    });
  });

  (guide?.unregistered_order_keys || []).forEach((raw: any) => {
    const text = String(raw || '');
    const split = text.indexOf('#');
    if (split < 0) return;
    const bucket = ensure(text.slice(0, split));
    const order = text.slice(split + 1).trim();
    if (bucket && isOrderNumberValue(order)) bucket.orders.add(order);
  });

  return [...byEmail.values()].filter((entry) => entry.orders.size > 0);
};

const CHUNK = 100;

// Marca los bultos de la guía y sus contenedores como despachados. Es idempotente:
// lo que ya está despachado no se vuelve a tocar y no toca nada fuera de la guía.
export async function markGuideDispatched(base44: any, guide: any) {
  const svc = base44.asServiceRole.entities;
  const codes = [...new Set((guide?.bulto_codes || []).map((code: any) => String(code || '').trim().toUpperCase()).filter(Boolean))];

  let bultosMarked = 0;
  for (let i = 0; i < codes.length; i += CHUNK) {
    const chunk = codes.slice(i, i + CHUNK);
    const result: any = await svc.Bulto.updateMany(
      { label_code: { $in: chunk }, status: { $ne: 'despachado' } },
      { $set: { status: 'despachado' } }
    ).catch(() => null);
    bultosMarked += Number(result?.updated) || 0;
  }

  let containersMarked = 0;
  for (const entry of containersOfGuide(guide)) {
    const result: any = await svc.CbmIngreso.updateMany(
      { client_email: entry.email, invoice_number: { $in: [...entry.orders] } },
      { $set: { disponible_entrega: true } }
    ).catch(() => null);
    containersMarked += Number(result?.updated) || 0;
  }

  return { bultos: bultosMarked, containers: containersMarked };
}