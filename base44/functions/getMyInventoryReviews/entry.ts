import { createClientFromRequest } from 'npm:@base44/sdk@0.8.59';

// Devuelve al cliente autenticado sus revisiones de almacén y las incidencias
// reportadas en sus paquetes (tipo, detalle y fotos con enlace temporal).
const TYPE_LABEL: Record<string, string> = { abierto: 'Paquete abierto', faltante: 'Contenido faltante', danado: 'Paquete dañado' };

const cleanNotes = (notes: string) => String(notes || '').replace(/^\[[^\]]*\]\s*/, '').trim();

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole;
    const [revRes, incRes] = await Promise.all([
      sr.entities.CajaInventoryReview.filter({ client_email: user.email }, '-reviewed_date', 200),
      sr.entities.WarehouseIncident.filter({ client_email: user.email }, '-reported_date', 200),
    ]);
    const reviews: any[] = Array.isArray(revRes) ? revRes : (revRes?.items || []);
    const incidents: any[] = Array.isArray(incRes) ? incRes : (incRes?.items || []);

    const sign = async (uri: string) => {
      if (/^https?:\/\//i.test(uri)) return uri;
      const r = await sr.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 3600 }).catch(() => null);
      return r?.signed_url || '';
    };
    const photosFor = async (inc: any) => {
      const uris = [...new Set([inc.photo_uri, ...(inc.photo_uris || [])].filter(Boolean))].slice(0, 4) as string[];
      return (await Promise.all(uris.map(sign))).filter(Boolean);
    };

    const incidentById = new Map(incidents.map((i) => [i.id, i]));
    const usedIncidents = new Set<string>();

    const items = reviews.map((r) => {
      const hasIssue = r.result === 'recibida_con_incidencia';
      const inc = r.incident_id ? incidentById.get(r.incident_id) : null;
      if (inc) usedIncidents.add(inc.id);
      return {
        id: r.id,
        tracking_number: r.tracking_number || inc?.tracking_number || r.label_code || '',
        container_number: r.container_number || inc?.container_number || '',
        date: r.reviewed_date || r.created_date,
        result: r.result,
        incident_type: hasIssue ? (inc?.incident_type || r.incident_type || 'otro') : null,
        incident_label: hasIssue ? (TYPE_LABEL[inc?.incident_type || r.incident_type] || 'Incidencia registrada') : null,
        detail: hasIssue ? cleanNotes(inc?.notes || r.notes) : '',
        _incident: hasIssue ? inc : null,
      };
    });

    // Incidencias reportadas sin una revisión asociada también se muestran.
    for (const inc of incidents) {
      if (usedIncidents.has(inc.id)) continue;
      items.push({
        id: inc.id,
        tracking_number: inc.tracking_number || '',
        container_number: inc.container_number || '',
        date: inc.reported_date || inc.created_date,
        result: 'recibida_con_incidencia',
        incident_type: inc.incident_type || 'otro',
        incident_label: TYPE_LABEL[inc.incident_type] || 'Incidencia registrada',
        detail: cleanNotes(inc.notes),
        _incident: inc,
      });
    }

    // Una sola tarjeta por tracking: se queda la más completa (con aviso, fotos,
    // detalle) y, a igualdad, la más reciente.
    const score = (it: any) =>
      (it.result === 'recibida_con_incidencia' ? 4 : 0) +
      (it._incident?.photo_uri || it._incident?.photo_uris?.length ? 2 : 0) +
      (it.detail ? 1 : 0);
    const time = (it: any) => new Date(it.date || 0).getTime();
    const byTracking: Record<string, any> = {};
    for (const it of items) {
      const key = String(it.tracking_number || '').replace(/\s+/g, '').toUpperCase() || `id:${it.id}`;
      const prev = byTracking[key];
      if (!prev || score(it) > score(prev) || (score(it) === score(prev) && time(it) > time(prev))) {
        byTracking[key] = it;
      }
    }
    const uniqueItems = Object.values(byTracking);

    const withPhotos = [];
    for (let i = 0; i < uniqueItems.length; i += 6) {
      const batch = await Promise.all(uniqueItems.slice(i, i + 6).map(async ({ _incident, ...rest }) => ({
        ...rest,
        photos: _incident ? await photosFor(_incident) : [],
      })));
      withPhotos.push(...batch);
    }
    withPhotos.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    return Response.json({ reviews: withPhotos });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}