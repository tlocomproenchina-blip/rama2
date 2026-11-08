// Contenido de una caja o bulto sin repetidos.
//
// Un mismo tracking cuenta una sola vez dentro de la unidad: se comparan los códigos sin
// distinguir mayúsculas, se descartan las etiquetas de unidades (-B## / -C##) y un código
// "sin registrar" que en realidad es el tracking de un paquete registrado dentro de la
// misma unidad deja de contarse dos veces.
const text = (v: any) => String(v ?? '').trim();
const up = (v: any) => text(v).toUpperCase();
export const isUnitLabel = (v: any) => /-[BC]\d+$/i.test(text(v));

export function uniqueCodes(list: any): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const code = text(raw);
    if (!code || isUnitLabel(code) || seen.has(up(code))) continue;
    seen.add(up(code));
    out.push(code);
  }
  return out;
}

export function dedupeUnitContents(unit: any, registeredCodes: string[] = []) {
  const registered = new Set((registeredCodes || []).map(up));
  return {
    package_ids: [...new Set((Array.isArray(unit?.package_ids) ? unit.package_ids : []).map(text).filter(Boolean))],
    package_trackings: uniqueCodes(unit?.package_trackings),
    unregistered_codes: uniqueCodes(unit?.unregistered_codes).filter((c) => !registered.has(up(c))),
  };
}