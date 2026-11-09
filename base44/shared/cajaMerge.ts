// Una sola caja consolidada por cliente.
//
// Cuando el almacén cierra una caja nueva para un cliente que ya tiene otra caja
// esperando en el almacén (del mismo N° de contenedor, o sin contenedor asignado), el
// contenido nuevo entra en esa caja en lugar de registrar una segunda caja.
const text = (v: any) => String(v ?? '').trim();
const up = (v: any) => text(v).toUpperCase();

// Estados de una caja ya cerrada que todavía está en el almacén.
const MERGEABLE = new Set(['cerrado', 'en_almacen_ve']);

export function ordersCompatible(a: any[] = [], b: any[] = []) {
  const left = (a || []).map(text).filter(Boolean);
  const right = (b || []).map(text).filter(Boolean);
  if (!left.length || !right.length) return true;
  return left.some((o) => right.includes(o));
}

export async function findCajaMergeTarget(
  base44: any,
  { clientEmail, labelCode, preferLabel = '', orders = [], skipLabels = [] }:
    { clientEmail: string; labelCode: string; preferLabel?: string; orders?: string[]; skipLabels?: string[] }
) {
  if (!text(clientEmail)) return null;
  const rows = await base44.asServiceRole.entities.Bulto
    .filter({ client_email: clientEmail, is_caja: true }, 'created_date', 100)
    .catch(() => []);
  const skip = new Set([labelCode, ...skipLabels].map(up).filter(Boolean));
  const candidates = (rows || []).filter((c: any) =>
    !skip.has(up(c.label_code))
    && MERGEABLE.has(text(c.status))
    && !c.dismantle_in_progress
    && ordersCompatible(c.cbm_order_numbers, orders)
  );
  if (!candidates.length) return null;
  return candidates.find((c: any) => up(c.label_code) === up(preferLabel)) || candidates[0];
}