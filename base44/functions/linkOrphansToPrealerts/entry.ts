import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { linkOrphanToPrealert } from '../../shared/orphanConsolidation.ts';

// Enlaza los paquetes huérfanos que YA estaban registrados en el almacén con la
// pre-alerta que su cliente declaró con el mismo tracking exacto: el huérfano se
// queda con su cliente y conserva su foto y sus datos de recepción, sin que nadie
// tenga que elegir el cliente a mano.
//
// Se revisa por lotes (los 200 huérfanos más recientes). Los que se enlazan salen de
// la lista de huérfanos, así que la corrida siguiente continúa con el resto. Un
// huérfano sin pre-alerta exacta, o con pre-alertas de varios clientes, no se toca.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const orphans = await base44.asServiceRole.entities.Package.filter({ is_orphan: true }, '-created_date', 200);
    const pendientes = (orphans || []).filter((p: any) => p && !String(p.client_email || '').trim());

    const problemas: any[] = [];
    let enlazados = 0;

    for (const orphan of pendientes) {
      try {
        const linked = await linkOrphanToPrealert(base44, orphan);
        if (linked.linked) {
          enlazados++;
        } else if (linked.reason === 'prealertas_de_varios_clientes') {
          problemas.push({ orphan_id: orphan.id, tracking_number: orphan.tracking_number, estado: 'conflicto', motivo: linked.reason });
        }
      } catch (err: any) {
        problemas.push({ orphan_id: orphan.id, tracking_number: orphan.tracking_number, estado: 'error', motivo: err?.message || 'error' });
      }
    }

    return Response.json({
      revisados: pendientes.length,
      enlazados,
      con_conflicto: problemas.filter((p) => p.estado === 'conflicto').length,
      con_error: problemas.filter((p) => p.estado === 'error').length,
      problemas: problemas.slice(0, 50),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}