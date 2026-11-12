import { base44 } from '@/api/base44Client';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SEARCH_FIELDS = ['client_name', 'client_code', 'client_email', 'tracking_number', 'container_number'];

// Arma el filtro del servidor para el historial de incidencias: texto (cliente,
// contenedor, tracking y código de bulto), tipo y día de reporte (hora local).
// El código de bulto no se guarda en la incidencia: se buscan primero los bultos
// con ese código y se filtra por su id.
export async function buildIncidentQuery(filters) {
  const query = {};
  const q = (filters.search || '').trim();
  if (q) {
    const rx = { $regex: esc(q), $options: 'i' };
    const or = SEARCH_FIELDS.map((f) => ({ [f]: rx }));
    const page = await base44.entities.Bulto.filter({ label_code: rx }, { limit: 200 });
    const ids = (page?.items || []).map((b) => b.id);
    if (ids.length) or.push({ bulto_id: { $in: ids } });
    query.$or = or;
  }
  if (filters.type && filters.type !== 'all') query.incident_type = filters.type;
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    query.reported_date = { $gte: start.toISOString(), $lt: end.toISOString() };
  }
  return query;
}