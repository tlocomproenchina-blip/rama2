import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Consolidación de bultos abiertos duplicados por cliente.
// El servidor acumula múltiples Bulto con status 'activo' para el mismo client_email
// (mismo shipping_mark), cada uno con 1 paquete. Esta función los fusiona en un solo
// bulto por cliente: el más antiguo (menor bulto_number) absorbe los package_ids y
// package_trackings de los demás, y los sobrantes se eliminan.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Listar todos los bultos abiertos (paginado por seguridad)
    const allBultos: any[] = [];
    let skip = 0;
    const pageSize = 500;
    while (true) {
      const batch = await base44.asServiceRole.entities.Bulto.filter(
        { status: 'activo' },
        'bulto_number',
        pageSize,
        skip
      );
      if (!batch || !batch.length) break;
      allBultos.push(...batch);
      if (batch.length < pageSize) break;
      skip += pageSize;
    }

    // Agrupar por client_email
    const groups: Record<string, any[]> = {};
    for (const b of allBultos) {
      const key = b.client_email || b.shipping_mark || '_unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    }

    let consolidatedGroups = 0;
    let deletedCount = 0;
    let mergedPackageCount = 0;

    for (const [email, bultos] of Object.entries(groups)) {
      if (bultos.length <= 1) continue;

      // Ordenar por bulto_number ascendente; el primero es el keeper
      bultos.sort((a, b) => (a.bulto_number || 0) - (b.bulto_number || 0));
      const keeper = bultos[0];
      const duplicates = bultos.slice(1);

      // Fusionar package_ids y package_trackings (sin duplicados)
      const mergedPackageIds = new Set<string>(keeper.package_ids || []);
      const mergedTrackings = new Set<string>(keeper.package_trackings || []);
      let addedPackages = 0;
      for (const dup of duplicates) {
        for (const pid of dup.package_ids || []) {
          if (pid && !mergedPackageIds.has(pid)) {
            mergedPackageIds.add(pid);
            addedPackages++;
          }
        }
        for (const trk of dup.package_trackings || []) {
          if (trk && !mergedTrackings.has(trk)) mergedTrackings.add(trk);
        }
      }

      const maxBultoNumber = Math.max(...bultos.map((b) => b.bulto_number || 0));

      // Actualizar el keeper con los paquetes fusionados
      await base44.asServiceRole.entities.Bulto.update(keeper.id, {
        package_ids: Array.from(mergedPackageIds),
        package_trackings: Array.from(mergedTrackings),
        total_bultos: maxBultoNumber,
      });

      // Eliminar los bultos sobrantes
      for (const dup of duplicates) {
        try {
          await base44.asServiceRole.entities.Bulto.delete(dup.id);
          deletedCount++;
        } catch (e) {
          // best-effort: continuar aunque uno falle
        }
      }

      consolidatedGroups++;
      mergedPackageCount += addedPackages;
    }

    return Response.json({
      success: true,
      totalOpenBultos: allBultos.length,
      groupsWithDuplicates: consolidatedGroups,
      deletedBultos: deletedCount,
      mergedPackages: mergedPackageCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}