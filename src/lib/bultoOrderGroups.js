// Agrupa los bultos del historial por cliente y N° de orden: todos los bultos de un mismo
// cliente con el mismo N° de orden forman una sola tarjeta del historial.
//
// - Un bulto sin N° de orden queda como entrada individual (una tarjeta por bulto).
// - Cuando un bulto trae varios N° de orden se usa el primero, así aparece una sola vez.
// - El grupo conserva la posición del bulto más reciente, porque la lista llega ordenada
//   por fecha descendente.
export function groupBultosByOrder(bultos) {
  const entries = [];
  const index = new Map();

  (bultos || []).forEach((bulto) => {
    const order = (Array.isArray(bulto?.cbm_order_numbers) ? bulto.cbm_order_numbers : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)[0];

    if (!order) {
      entries.push({
        key: `bulto:${bulto.id}`,
        order: '',
        client_email: bulto.client_email || '',
        bultos: [bulto],
      });
      return;
    }

    const client = String(bulto.client_email || bulto.shipping_mark || '').trim().toLowerCase();
    const key = `orden:${client}|${order.toLowerCase()}`;
    const existing = index.get(key);
    if (existing) {
      existing.bultos.push(bulto);
      return;
    }

    const entry = { key, order, client_email: bulto.client_email || '', bultos: [bulto] };
    index.set(key, entry);
    entries.push(entry);
  });

  return entries;
}