const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SEARCH_FIELDS = ['shipping_mark', 'invoice_number', 'client_name', 'client_email', 'rif', 'legal_name', 'request_number'];

// Filtro del servidor para el panel: texto (Shipping Mark, factura, cliente, RIF),
// estado y rango de fechas de creación.
export function buildFiscalQuery(f) {
  const query = {};
  const text = (f.search || '').trim();
  if (text) {
    const rx = { $regex: esc(text), $options: 'i' };
    query.$or = SEARCH_FIELDS.map((k) => ({ [k]: rx }));
  }
  if (f.status && f.status !== 'all') query.status = f.status;
  if (f.from || f.to) {
    query.created_date = {};
    if (f.from) query.created_date.$gte = new Date(`${f.from}T00:00:00`).toISOString();
    if (f.to) {
      const end = new Date(`${f.to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      query.created_date.$lt = end.toISOString();
    }
  }
  return query;
}