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
      // 1) Buscar paquete por tracking_number probando candidatos de sub-tracking.
      //    El escáner suele leer el sub-tracking (master + sufijo de caja: 001, 002…),
      //    así que removemos 3,2,4,1,5,6 dígitos del final para encontrar el master.
      const removalOrder = [0, 3, 2, 4, 1, 5, 6];
      const seenCandidates = new Set<string>();
      const candidates: string[] = [];
      for (const remove of removalOrder) {
        if (remove === 0) {
          if (!seenCandidates.has(tracking)) {
            seenCandidates.add(tracking);
            candidates.push(tracking);
          }
          continue;
        }
        if (tracking.length - remove < 5) continue;
        const candidate = tracking.slice(0, tracking.length - remove);
        if (!seenCandidates.has(candidate)) {
          seenCandidates.add(candidate);
          candidates.push(candidate);
        }
      }

      let pkg = null;
      for (const candidate of candidates) {
        const matches = await base44.asServiceRole.entities.Package.filter(
          { tracking_number: candidate }, '-created_date', 1
        );
        if (matches?.[0]) {
          pkg = matches[0];
          break;
        }
      }

      // 2) Si no se encuentra por tracking_number, buscar por label_code
      //    (código de etiqueta TLEC, formato shipping_mark-L##)
      if (!pkg) {
        const labelMatches = await base44.asServiceRole.entities.Package.filter(
          { label_code: tracking }, '-created_date', 1
        );
        if (labelMatches?.[0]) pkg = labelMatches[0];
      }

      // 3) Si tampoco hay Package, buscar en ShippingLabel por label_code y
      //    auto-crear la pre-alerta con el cliente de la etiqueta (sin huérfano)
      if (!pkg) {
        const labels = await base44.asServiceRole.entities.ShippingLabel.filter(
          { label_code: tracking }, '-created_date', 1
        );
        const label = labels?.[0];
        if (label) {
          pkg = await base44.asServiceRole.entities.Package.create({
            tracking_number: '',
            client_email: label.client_email,
            shipping_mark: label.shipping_mark,
            label_code: label.label_code,
            shipping_type: 'maritimo',
            risk_category: (label.has_battery || label.has_liquid || label.has_powder || label.has_fbrand) ? 'alto_riesgo' : 'general',
            package_count: label.box_count || 1,
            description: label.content || 'Etiqueta TLEC',
            status: 'pre_alerta',
            is_orphan: false,
          });
          // Vincular la etiqueta al paquete creado
          try {
            await base44.asServiceRole.entities.ShippingLabel.update(label.id, {
              status: 'vinculada',
              linked_package_id: pkg.id,
            });
          } catch (_) {}
        }
      }

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
        // No existe pre-alerta ni etiqueta TLEC → crear huérfano
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