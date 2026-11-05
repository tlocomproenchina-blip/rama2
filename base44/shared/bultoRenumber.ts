// Cambio manual del número de un bulto o caja desde el historial de la Mesa de empaque.
//
// El número nuevo solo se acepta si ningún otro bulto o caja lo usa (ni como número ni
// como código de etiqueta). Si se acepta, el código de etiqueta cambia con él
// (…-B## / …-C##) y las guías de despacho que tenían el código viejo quedan con el nuevo.
import { normCode, unique } from './dispatchGuideAppend.ts';

const text = (value: any) => String(value ?? '').trim();

export function renumberedLabel(labelCode: string, number: number) {
  const label = text(labelCode);
  if (/-[BC]\d+$/i.test(label)) return label.replace(/-([BC])\d+$/i, (_m, p) => `-${p.toUpperCase()}${number}`);
  return label;
}

// Número visible de la unidad: el del código de etiqueta (-B## / -C##).
export function labelNumber(bulto: any) {
  const match = text(bulto?.label_code).match(/-[BC](\d+)$/i);
  return match ? Number(match[1]) : Number(bulto?.bulto_number) || 0;
}

// Devuelve el código nuevo o un mensaje de error si el número no está disponible.
export async function checkBultoNumber(base44: any, bulto: any, rawNumber: any) {
  const number = Math.round(Number(rawNumber));
  if (!Number.isFinite(number) || number < 1) return { error: 'El número de bulto debe ser 1 o más' };

  const labelCode = renumberedLabel(bulto.label_code, number);
  const [byNumber, byLabel] = await Promise.all([
    base44.asServiceRole.entities.Bulto.filter({ bulto_number: number, is_caja: { $ne: true } }, '-created_date', 5).catch(() => []),
    base44.asServiceRole.entities.Bulto.filter({ label_code: { $regex: `-[BbCc]${number}$` } }, '-created_date', 5).catch(() => []),
  ]);
  const taken = [...(byNumber || []), ...(byLabel || [])].find((row: any) => row?.id && row.id !== bulto.id);
  if (taken) {
    return { error: `El número ${number} no está disponible: lo usa ${taken.label_code || 'otro bulto'}` };
  }
  return { number, label_code: labelCode };
}

// Las guías ya emitidas con el código viejo pasan a mostrar el código nuevo.
export async function renameCodeInGuides(base44: any, oldCode: string, newCode: string, actor = '') {
  const from = normCode(oldCode);
  const to = normCode(newCode);
  if (!from || !to || from === to) return 0;

  const guides: any[] = await base44.asServiceRole.entities.DispatchGuide
    .filter({ bulto_codes: from }, '-emitted_date', 50)
    .catch(() => []);

  for (const guide of guides || []) {
    const clients = (Array.isArray(guide.clients) ? guide.clients : []).map((client: any) => ({
      ...client,
      bultos: (client.bultos || []).map((line: any) =>
        normCode(line?.label_code) === from ? { ...line, label_code: newCode } : line
      ),
    }));
    await base44.asServiceRole.entities.DispatchGuide.update(guide.id, {
      clients,
      bulto_codes: unique((guide.bulto_codes || []).map((c: string) => (normCode(c) === from ? to : normCode(c)))),
      last_updated_date: new Date().toISOString(),
      last_updated_by: actor || 'Cambio de número de bulto',
    });
  }
  return (guides || []).length;
}