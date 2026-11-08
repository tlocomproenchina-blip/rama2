// Paletas físicas de una guía: los bultos y cajas de un cliente montados y envueltos
// en envoplast. La empresa de transporte cuenta paletas; el cliente, los bultos de
// adentro. Cada paleta se identifica con el mark del cliente y su posición X/N.
const low = (value) => String(value || '').trim().toLowerCase();
const up = (value) => String(value || '').trim().toUpperCase();
const markOf = (client) => up(client?.shipping_mark || client?.client?.shipping_mark);

export const palletClientKey = (client) => {
  const email = low(client?.client_email);
  if (email) return `email:${email}`;
  const mark = markOf(client);
  if (mark) return `mark:${mark}`;
  return `name:${low(client?.client_name)}`;
};

// Busca la anotación de paletas de un cliente: por email, o por mark si falta el email.
export const palletCountFor = (pallets, client) => {
  const email = low(client?.client_email);
  const mark = markOf(client);
  const hit = (Array.isArray(pallets) ? pallets : []).find((entry) => {
    const entryEmail = low(entry?.client_email);
    if (email && entryEmail) return entryEmail === email;
    return !!mark && up(entry?.shipping_mark) === mark;
  });
  return Math.max(0, Math.floor(Number(hit?.count) || 0));
};

export const palletsTotalOf = (pallets) =>
  (Array.isArray(pallets) ? pallets : []).reduce((sum, entry) => sum + (Math.floor(Number(entry?.count)) || 0), 0);

// "1/2, 2/2": la numeración que se escribe en cada paleta.
export const palletSequence = (count) =>
  Array.from({ length: Math.max(0, count) }, (_, i) => `${i + 1}/${count}`).join(', ');

export const buildPalletEntries = (clients, values) =>
  (clients || [])
    .map((client) => ({
      client_key: client.key || palletClientKey(client),
      client_email: client.client_email || '',
      client_name: client.client_name || '',
      shipping_mark: client.shipping_mark || client.client?.shipping_mark || '',
      count: Math.max(0, Math.floor(Number(values?.[client.key || palletClientKey(client)]) || 0)),
    }))
    .filter((entry) => entry.count > 0);

// Facturas y contenedores de las líneas de un cliente en la guía.
export const clientRefsOf = (bultos, extraInvoice = '') => {
  const lines = Array.isArray(bultos) ? bultos : [];
  return {
    containers: [...new Set(lines.map((b) => b.order_number).filter(Boolean))],
    invoices: [...new Set([extraInvoice, ...lines.map((b) => b.invoice_number)].filter(Boolean))],
  };
};