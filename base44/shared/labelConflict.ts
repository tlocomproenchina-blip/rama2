// Códigos de etiqueta repetidos entre operadores de la Mesa de empaque.
//
// Si dos unidades distintas llegan a registrarse con el mismo código, el código se
// queda con la primera y la otra recibe uno nuevo (mismo contador de bultos y cajas).
// Así ninguna de las dos pierde su contenido y la segunda reimprime con su código nuevo.
import { nextBultoNumber } from './bultoNumber.ts';

const text = (v: any) => String(v ?? '').trim();
const up = (v: any) => text(v).toUpperCase();

// ¿El registro existente es el mismo trabajo que llega ahora (un reintento)?
export function isSameWork(existing: any, localUnitId: string, codes: string[]) {
  const mine = new Set((codes || []).map(up).filter(Boolean));
  if (!mine.size) return true; // unidad vacía: no hay trabajo que perder
  const owner = text(existing?.local_unit_id);
  if (owner && text(localUnitId)) return owner === text(localUnitId);
  const theirs = [
    ...(existing?.package_trackings || []),
    ...(existing?.unregistered_codes || []),
  ].map(up);
  return theirs.some((c) => mine.has(c));
}

// Código nuevo y libre con el mismo shipping mark: -B## para bultos, -C## para cajas.
export async function reassignLabelCode(base44: any, labelCode: string, kind: 'B' | 'C') {
  const mark = text(labelCode).replace(/-[BC]\d+$/i, '');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = await nextBultoNumber(base44);
    if (!number) break;
    const code = mark ? `${mark}-${kind}${number}` : `${kind}${number}`;
    const rows = await base44.asServiceRole.entities.Bulto
      .filter({ label_code: code }, '-created_date', 1)
      .catch(() => []);
    if (!rows?.length) return { label_code: code, number };
  }
  return null;
}

// Dos registros simultáneos con el mismo código: el más antiguo lo conserva y el recién
// creado (si no es el primero) pasa a un código nuevo.
export async function settleCreateRace(base44: any, created: any, kind: 'B' | 'C') {
  const rows = await base44.asServiceRole.entities.Bulto
    .filter({ label_code: created.label_code }, 'created_date', 5)
    .catch(() => []);
  if (!rows?.length || rows.length < 2 || rows[0].id === created.id) return { record: created, relabeled: null };
  const fresh = await reassignLabelCode(base44, created.label_code, kind);
  if (!fresh) return { record: created, relabeled: null };
  const record = await base44.asServiceRole.entities.Bulto.update(created.id, {
    label_code: fresh.label_code,
    bulto_number: fresh.number,
    relabeled_from: created.label_code,
  });
  return {
    record: { ...created, ...(record || {}), label_code: fresh.label_code, bulto_number: fresh.number },
    relabeled: { from: created.label_code, to: fresh.label_code, number: fresh.number },
  };
}