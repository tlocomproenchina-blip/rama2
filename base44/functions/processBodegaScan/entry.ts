import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Procesa un escaneo desde la bodega en China.
// Recibe: { tracking_number, photo_url, device_id, manual? }
// - Si el tracking existe en Package y está en pre_alerta → marca recibido.
// - Si el tracking no existe → crea huérfano.
// - Si no hay tracking (foto manual) → crea huérfano sin tracking.
// Retorna: { result_type, shipping_mark, tracking_number, package_id }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const tracking = String(body.tracking_number || '').trim();
    const photoUrl = body.photo_url ? String(body.photo_url) : null;
    const deviceId = String(body.device_id || '').trim();

    if (!deviceId) return Response.json({ error: 'device_id requerido' }, { status: 400 });

    const now = new Date().toISOString();
    let resultType = 'huerfano';
    let shippingMark = '';
    let packageId: string | null = null;

    if (tracking) {
      // Buscar paquete por tracking_number
      const packages = await base44.asServiceRole.entities.Package.filter(
        { tracking_number: tracking }, '-created_date', 1
      );
      const pkg = packages?.[0];

      if (pkg) {
        if (pkg.status === 'pre_alerta') {
          // Marcar como recibido
          await base44.asServiceRole.entities.Package.update(pkg.id, {
            status: 'recibido',
            received_date: now,
            received_by: `Bodega China (${deviceId})`,
            package_image_url: photoUrl,
            package_image_urls: photoUrl ? [photoUrl] : (pkg.package_image_urls || []),
          });
          resultType = 'recibido';
          shippingMark = pkg.shipping_mark || '';
          packageId = pkg.id;
        } else {
          // Ya estaba recibido o en otro estado → duplicado
          resultType = 'duplicado';
          shippingMark = pkg.shipping_mark || '';
          packageId = pkg.id;
        }
      } else {
        // No existe pre-alerta → crear huérfano
        const orphan = await base44.asServiceRole.entities.Package.create({
          tracking_number: tracking,
          client_email: '',
          shipping_type: 'maritimo',
          description: 'Paquete huérfano (Bodega China, sin pre-alerta)',
          status: 'sin_cliente',
          is_orphan: true,
          received_date: now,
          received_by: `Bodega China (${deviceId})`,
          package_image_url: photoUrl,
          package_image_urls: photoUrl ? [photoUrl] : [],
        });
        resultType = 'huerfano';
        packageId = orphan.id;
      }
    } else {
      // Sin tracking → foto manual → crear huérfano con pseudo-tracking
      const pseudoTracking = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const orphan = await base44.asServiceRole.entities.Package.create({
        tracking_number: pseudoTracking,
        client_email: '',
        shipping_type: 'maritimo',
        description: 'Paquete huérfano (Bodega China, foto manual sin tracking)',
        status: 'sin_cliente',
        is_orphan: true,
        received_date: now,
        received_by: `Bodega China (${deviceId})`,
        package_image_url: photoUrl,
        package_image_urls: photoUrl ? [photoUrl] : [],
      });
      resultType = 'huerfano';
      packageId = orphan.id;
    }

    // Registrar escaneo en log (best-effort)
    try {
      await base44.asServiceRole.entities.EscaneoBodega.create({
        device_id: deviceId,
        tracking_number: tracking || '(foto manual)',
        shipping_mark: shippingMark,
        photo_url: photoUrl,
        result_type: resultType,
      });
    } catch (_) {}

    // Actualizar dispositivo (best-effort)
    try {
      const devices = await base44.asServiceRole.entities.DispositivoBodega.filter(
        { device_id: deviceId }, '-created_date', 1
      );
      if (devices?.[0]) {
        await base44.asServiceRole.entities.DispositivoBodega.update(devices[0].id, {
          last_activity: now,
          total_scans: (devices[0].total_scans || 0) + 1,
        });
      }
    } catch (_) {}

    return Response.json({
      result_type: resultType,
      shipping_mark: shippingMark,
      tracking_number: tracking,
      package_id: packageId,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}