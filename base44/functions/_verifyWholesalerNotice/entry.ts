import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getPrimaryConnection } from '../../shared/wholesalerCore.ts';
import { trackingOwnerFor, receptionPhotos } from '../../shared/wholesalerPackages.ts';

// Verificación temporal (solo lectura): comprueba que el titular de un tracking se
// resuelve en el contexto del mayorista y que los módulos compartidos cargan bien.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const connection = await getPrimaryConnection(base44);

    const orphans = await base44.asServiceRole.entities.Package
      .filter({ is_orphan: true }, '-created_date', 5);

    const muestras: any[] = [];
    for (const pkg of orphans || []) {
      const titular = await trackingOwnerFor(base44, pkg, connection);
      muestras.push({
        tracking: pkg.tracking_number || '',
        shipping_mark: pkg.shipping_mark || '',
        client_email_paquete: pkg.client_email || '',
        fotos: receptionPhotos(pkg).length,
        titular: titular ? { email: titular.email || '', external_id: titular.external_id || '' } : null,
      });
    }

    return Response.json({
      conexion: { id: connection?.id || '', key: connection?.config_key || '', name: connection?.wholesaler_name || '' },
      huerfanos_revisados: muestras.length,
      muestras,
    });
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}