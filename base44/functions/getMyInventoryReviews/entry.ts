import { createClientFromRequest } from 'npm:@base44/sdk@0.8.59';

// Devuelve al cliente autenticado solo sus revisiones de almacén, sin fotos ni notas internas.
const TYPE_LABEL: Record<string, string> = { abierto: 'Paquete abierto', faltante: 'Contenido faltante', danado: 'Paquete dañado' };

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const res = await base44.asServiceRole.entities.CajaInventoryReview.filter({ client_email: user.email }, '-reviewed_date', 200);
  const list = Array.isArray(res) ? res : (res?.items || []);
  const reviews = list.map((r: any) => ({
    id: r.id,
    tracking_number: r.tracking_number || r.label_code || '',
    container_number: r.container_number || '',
    date: r.reviewed_date || r.created_date,
    result: r.result,
    incident_label: r.result === 'recibida_con_incidencia' ? (TYPE_LABEL[r.incident_type] || 'Incidencia registrada') : null,
  }));
  return Response.json({ reviews });
}