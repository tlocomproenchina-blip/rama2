import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

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

    const uniqueTrackings = [...new Set(trackingNumbers.map((t) => String(t).trim()).filter(Boolean))];

    // Buscar los paquetes por lotes ($in) y en paralelo. Antes se hacía una
    // consulta por cada tracking de forma secuencial, lo que tardaba segundos
    // cuando había cientos de paquetes en el historial.
    const trackingBatches = chunk(uniqueTrackings, 100);
    const packageResults = await Promise.all(
      trackingBatches.map((batch) =>
        base44.asServiceRole.entities.Package
          .filter({ tracking_number: { $in: batch } }, '-updated_date', batch.length * 4)
          .catch(() => [])
      )
    );

    const packageMap = {}; // tracking -> package
    const consolidationIds = new Set();
    for (const pkg of packageResults.flat()) {
      const tracking = String(pkg?.tracking_number || '').trim();
      if (!tracking || packageMap[tracking]) continue;
      packageMap[tracking] = pkg;
      if (pkg.consolidation_id) consolidationIds.add(pkg.consolidation_id);
    }

    // Buscar las consolidaciones en paralelo
    const consolidationMap = {}; // id -> consolidation_tracking
    await Promise.all(
      [...consolidationIds].map(async (consId) => {
        try {
          const cons = await base44.asServiceRole.entities.Consolidation.get(consId);
          if (cons) consolidationMap[consId] = cons.consolidation_tracking || '';
        } catch (_) {}
      })
    );

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