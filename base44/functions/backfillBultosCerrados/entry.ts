import { createClientFromRequest } from 'npm:@base44/sdk@0.8.51';
import { fetchAllFilter, normTracking, errorMessage, BATCH } from '../../shared/paginatedFetch.ts';

// Corrección única de los bultos que quedaron en el estado huérfano 'cerrado'
// (sellados sin pasar a almacén Venezuela, invisibles para facturación).
// - Bultos cuyos paquetes ya están dentro de una orden de despacho NO cancelada
//   → 'despachado' (su carga ya fue asignada al cliente).
// - El resto → 'en_almacen_ve' (carga en almacén de Venezuela, lista para facturar).
// No crea ni suelta paquetes, no toca números de contenedor ni facturas ya generadas.
// Idempotente: al repetirla ya no encuentra bultos en 'cerrado' y no cambia nada.
// Devuelve { updated, to_almacen_ve, to_despachado, total_cerrados, errors }.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const svc = base44.asServiceRole.entities;

    const [cerrados, ordenes] = await Promise.all([
      fetchAllFilter(svc.Bulto, { status: 'cerrado' }, '-created_date'),
      fetchAllFilter(svc.DispatchOrder, { status: { $ne: 'cancelada' } }, '-created_date'),
    ]);

    // Trackings de carga ya listada en una orden de despacho vigente
    const trackingsEnOrden = new Set<string>();
    for (const o of ordenes || []) {
      for (const it of (o.items || [])) {
        const key = normTracking(it.tracking_number);
        if (key) trackingsEnOrden.add(key);
      }
    }

    const destino: Record<string, string> = {};
    let toAlmacenVe = 0;
    let toDespachado = 0;
    for (const b of cerrados || []) {
      const trackings = (b.package_trackings || []).map(normTracking).filter(Boolean);
      const yaDespachado = trackings.some((t: string) => trackingsEnOrden.has(t));
      destino[b.id] = yaDespachado ? 'despachado' : 'en_almacen_ve';
      if (yaDespachado) toDespachado++;
      else toAlmacenVe++;
    }

    const ids = Object.keys(destino);
    const errors: any[] = [];
    let updated = 0;

    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      try {
        await svc.Bulto.bulkUpdate(chunk.map((id) => ({ id, status: destino[id] })));
        updated += chunk.length;
      } catch (_) {
        for (const id of chunk) {
          try {
            await svc.Bulto.update(id, { status: destino[id] });
            updated++;
          } catch (err: any) {
            errors.push({ id, error: errorMessage(err) });
          }
        }
      }
    }

    return Response.json({
      success: true,
      updated,
      to_almacen_ve: toAlmacenVe,
      to_despachado: toDespachado,
      total_cerrados: ids.length,
      errors,
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}