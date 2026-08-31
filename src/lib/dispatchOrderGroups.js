// Normaliza un número de tracking de forma consistente con AdminManualBilling:
// quita prefijos de transportista (split por ":" o "：") y lo pasa a mayúsculas.
const normTracking = (raw) => String(raw || '').split(/[:：]/).pop().trim().toUpperCase();

// Construye un mapa { tracking_normalizado: numero_de_recibo } a partir de
// los CbmIngreso del cliente. Cada ingreso aporta su invoice_number como
// recibo y todos los trackings que contiene (soporta trackings combinados
// separados por espacios, comas, punto y coma o pipe).
export function buildTrackingToReceiptMap(ingresos) {
  const map = {};
  (Array.isArray(ingresos) ? ingresos : []).forEach((ing) => {
    const receipt = String(ing.invoice_number || ing.descripcion || '').trim();
    if (!receipt) return;
    const trackings = Array.isArray(ing.tracking_numbers) ? ing.tracking_numbers : [];
    trackings.forEach((raw) => {
      String(raw || '')
        .split(/[，,;|\s]+/)
        .map(normTracking)
        .filter(Boolean)
        .forEach((t) => {
          if (!map[t]) map[t] = receipt;
        });
    });
  });
  return map;
}

// Agrupa los items de una orden de despacho por su recibo (consolidation_tracking).
// Si un item no tiene consolidation_tracking, busca el recibo real en
// trackingToReceipt (mapa construido desde CbmIngreso) usando su tracking_number.
// Los items que tampoco aparecen en CbmIngreso se agrupan bajo "Sin recibo".
// Devuelve un array de grupos: { receipt, count, items }
export function groupItemsByReceipt(items, trackingToReceipt = {}) {
  const list = Array.isArray(items) ? items : [];
  const map = new Map();
  for (const item of list) {
    let receipt = (item?.consolidation_tracking || '').trim();
    if (!receipt && trackingToReceipt && item?.tracking_number) {
      const t = normTracking(item.tracking_number);
      receipt = trackingToReceipt[t] || '';
    }
    const key = receipt || 'Sin recibo';
    if (!map.has(key)) {
      map.set(key, { receipt: key, count: 0, items: [] });
    }
    const g = map.get(key);
    g.items.push(item);
    g.count += 1;
  }
  // Ordenar: los que tienen recibo primero, "Sin recibo" al final
  const groups = Array.from(map.values());
  groups.sort((a, b) => {
    if (a.receipt === 'Sin recibo') return 1;
    if (b.receipt === 'Sin recibo') return -1;
    return a.receipt.localeCompare(b.receipt, undefined, { numeric: true });
  });
  return groups;
}