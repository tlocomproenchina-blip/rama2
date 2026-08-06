// Agrupa los items de una orden de despacho por su recibo (consolidation_tracking).
// Los items sin recibo se agrupan bajo "Sin recibo".
// Devuelve un array de grupos: { receipt, count, items }
export function groupItemsByReceipt(items) {
  const list = Array.isArray(items) ? items : [];
  const map = new Map();
  for (const item of list) {
    const receipt = (item?.consolidation_tracking || '').trim() || 'Sin recibo';
    if (!map.has(receipt)) {
      map.set(receipt, { receipt, count: 0, items: [] });
    }
    const g = map.get(receipt);
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