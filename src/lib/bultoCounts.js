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