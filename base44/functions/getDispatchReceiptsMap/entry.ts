import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Devuelve un mapa { tracking_number: consolidation_tracking } para los trackings dados.
// Se usa para enriquecer órdenes de despacho que no tienen consolidation_tracking en sus items.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const trackingNumbers = Array.isArray(body?.tracking_numbers) ? body.tracking_numbers : [];
    if (trackingNumbers.length === 0) return Response.json({ map: {} });

    // Buscar paquetes por tracking_number (uno a uno, ya que filter es exacto)
    const uniqueTrackings = [...new Set(trackingNumbers.map((t) => String(t).trim()).filter(Boolean))];
    const packageMap = {}; // tracking -> package
    const consolidationIds = new Set();

    for (const tracking of uniqueTrackings) {
      try {
        const matches = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking }, '-updated_date', 1);
        const pkg = matches?.[0];
        if (pkg) {
          packageMap[tracking] = pkg;
          if (pkg.consolidation_id) consolidationIds.add(pkg.consolidation_id);
        }
      } catch (_) {}
    }

    // Buscar consolidaciones
    const consolidationMap = {}; // id -> consolidation_tracking
    for (const consId of consolidationIds) {
      try {
        const cons = await base44.asServiceRole.entities.Consolidation.get(consId);
        if (cons) consolidationMap[consId] = cons.consolidation_tracking || '';
      } catch (_) {}
    }

    // Construir el mapa final
    const result = {};
    for (const [tracking, pkg] of Object.entries(packageMap)) {
      if (pkg.consolidation_id && consolidationMap[pkg.consolidation_id]) {
        result[tracking] = consolidationMap[pkg.consolidation_id];
      }
    }

    return Response.json({ map: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}