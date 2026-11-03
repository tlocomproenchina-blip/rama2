// Etiquetas automáticas del CRM: se calculan con los datos reales del cliente.
//   mayorista     -> está en la lista de clientes del mayorista
//   con_deuda     -> facturas pendientes, vencidas o en revisión con saldo
//   cliente_nuevo -> se registró hace 30 días o menos
//   en_almacen    -> paquetes recibidos en almacén o disponibles para entrega
//   en_camino     -> paquetes consolidados o en tránsito
// También devuelve el saldo pendiente y el nombre / Shipping Mark de cada cliente.

const DAY = 24 * 60 * 60 * 1000;

async function groupCount(entity, query) {
  const res = await entity.aggregate({ query, groupBy: 'client_email' });
  return new Set((res?.rows || []).filter((r) => r.client_email && r.count > 0).map((r) => r.client_email));
}

export async function computeAutoTags(sr, emails) {
  const list = [...new Set(emails.filter(Boolean))];
  const tags = {};
  const balances = {};
  const profiles = {};
  list.forEach((e) => { tags[e] = []; });
  if (!list.length) return { tags, balances, profiles };

  const inEmails = { $in: list };
  const [wholesale, debt, users, warehouse, transit] = await Promise.allSettled([
    sr.entities.WholesalerClient.filter({ email: inEmails }, '-created_date', 1000),
    sr.entities.Invoice.aggregate({
      query: { client_email: inEmails, status: { $in: ['pendiente', 'vencida', 'revision'] } },
      groupBy: 'client_email',
      sum: ['total', 'paid_amount'],
    }),
    sr.entities.User.filter({ email: inEmails }, '-created_date', 1000),
    groupCount(sr.entities.Package, { client_email: inEmails, status: { $in: ['recibido', 'disponible'] } }),
    groupCount(sr.entities.Package, { client_email: inEmails, status: { $in: ['consolidado', 'en_transito'] } }),
  ]);

  const add = (email, tag) => { if (tags[email] && !tags[email].includes(tag)) tags[email].push(tag); };

  if (wholesale.status === 'fulfilled') (wholesale.value || []).forEach((w) => add(w.email, 'mayorista'));
  if (debt.status === 'fulfilled') {
    (debt.value?.rows || []).forEach((r) => {
      const balance = (Number(r.sum_total) || 0) - (Number(r.sum_paid_amount) || 0);
      balances[r.client_email] = Math.max(0, Math.round(balance * 100) / 100);
      if (balance > 0.01) add(r.client_email, 'con_deuda');
    });
  } else {
    console.log('debt aggregate failed', debt.reason?.message);
  }
  if (users.status === 'fulfilled') {
    (users.value || []).forEach((u) => {
      profiles[u.email] = {
        name: u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
        shipping_mark: u.shipping_mark || '',
      };
      if (u.created_date && Date.now() - new Date(u.created_date).getTime() <= 30 * DAY) add(u.email, 'cliente_nuevo');
    });
  }
  if (warehouse.status === 'fulfilled') warehouse.value.forEach((e) => add(e, 'en_almacen'));
  else console.log('warehouse aggregate failed', warehouse.reason?.message);
  if (transit.status === 'fulfilled') transit.value.forEach((e) => add(e, 'en_camino'));

  return { tags, balances, profiles };
}