// Conteo real de paquetes de un bulto o caja consolidada: lo que quedó físicamente
// dentro, contado una sola vez por paquete. Nunca suma las etiquetas de los bultos
// (-B## / -C##) que se fusionaron dentro, y una caja consolidada cuenta únicamente
// los paquetes registrados que agrupó.
const isBultoLabel = (code) => /-[BC]\d+$/i.test(String(code || '').trim());

export function realPackageCount(bulto) {
  const ids = Array.isArray(bulto?.package_ids) ? bulto.package_ids : [];
  const registered = ids.filter((id) => id && !String(id).startsWith('local_')).length;
  if (bulto?.is_caja) return registered;
  const unregistered = (Array.isArray(bulto?.unregistered_codes) ? bulto.unregistered_codes : [])
    .filter((code) => code && !isBultoLabel(code)).length;
  return registered + unregistered;
}

// Códigos que la etiqueta imprime como CONTENIDO: exactamente los paquetes que cuenta
// realPackageCount, sin las etiquetas de bultos ya fusionados ni códigos repetidos.
export function labelContentCodes(bulto) {
  const clean = (list) => [...new Set((Array.isArray(list) ? list : [])
    .map((code) => String(code ?? '').trim())
    .filter((code) => code && !isBultoLabel(code)))];
  const trackings = clean(bulto?.package_trackings);
  const unregistered = clean(bulto?.unregistered_codes);
  if (bulto?.is_caja) {
    // La caja cuenta solo los paquetes registrados: los códigos sin registrar no entran.
    const unregisteredSet = new Set(unregistered.map((code) => code.toUpperCase()));
    return trackings.filter((code) => !unregisteredSet.has(code.toUpperCase()));
  }
  const shown = new Set(trackings.map((code) => code.toUpperCase()));
  return [...trackings, ...unregistered.filter((code) => !shown.has(code.toUpperCase()))];
}