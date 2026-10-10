// Cálculo de la factura al mayorista, del lado de la pantalla.
// El servidor vuelve a calcular todo al emitir: esto es solo la vista previa.

export const HANDLING_FEE = 1;

export function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function draftOrders(draft) {
  return (draft?.orders || []).filter((o) => o?.checked !== false && String(o?.order_number || '').trim());
}

export function draftAmounts(draft) {
  const orders = draftOrders(draft);
  const cbm = round2(orders.reduce((sum, o) => sum + (Number(o.cbm) || 0), 0));
  const received = orders.reduce((sum, o) => sum + (Number(o.received) || 0) + (o.picked?.length || 0), 0);
  const shipping = round2(cbm * (Number(draft?.rate_per_cbm) || 0));
  const doorToDoor = round2(cbm * (Number(draft?.door_to_door_per_cbm) || 0));
  const handling = round2(received * HANDLING_FEE);
  return {
    orders: orders.length,
    cbm,
    received,
    shipping,
    doorToDoor,
    handling,
    total: round2(shipping + doorToDoor + handling),
  };
}

export function invoiceTotals(drafts) {
  const totals = { clients: 0, orders: 0, cbm: 0, received: 0, shipping: 0, doorToDoor: 0, handling: 0, total: 0 };
  for (const draft of Object.values(drafts || {})) {
    const amounts = draftAmounts(draft);
    if (!amounts.orders) continue;
    totals.clients += 1;
    totals.orders += amounts.orders;
    totals.cbm = round2(totals.cbm + amounts.cbm);
    totals.received += amounts.received;
    totals.shipping = round2(totals.shipping + amounts.shipping);
    totals.doorToDoor = round2(totals.doorToDoor + amounts.doorToDoor);
    totals.handling = round2(totals.handling + amounts.handling);
    totals.total = round2(totals.total + amounts.total);
  }
  return totals;
}