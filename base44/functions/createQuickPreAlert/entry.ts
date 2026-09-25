import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Crea una "Pre-alerta rápida" o, si coincide por sub-tracking con una
// pre-alerta existente del cliente, marca esa pre-alerta como recibida
// (conservando todos los datos del cliente + adjuntando la foto) sin duplicar.
//
// Recibe: { tracking_number, client_email, shipping_type, photo_url? }
// Retorna: { action: 'merged' | 'created', package_id }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: se requiere rol admin' }, { status: 403 });
    }

    const body = await req.json();
    const tracking = String(body.tracking_number || '').trim();
    const clientEmail = String(body.client_email || '').trim();
    const shippingType = body.shipping_type === 'aereo' ? 'aereo' : 'maritimo';
    const photoUrl = body.photo_url ? String(body.photo_url) : null;

    if (!tracking) return Response.json({ error: 'tracking_number requerido' }, { status: 400 });
    if (!clientEmail) return Response.json({ error: 'client_email requerido' }, { status: 400 });

    const now = new Date().toISOString();

    // 1) Buscar pre-alerta del cliente usando candidatos de sub-tracking
    //    (misma lógica que processBodegaScan: quitar 0,3,2,4,1,5,6 dígitos).
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

    let existingPkg = null;
    for (const candidate of candidates) {
      const matches = await base44.asServiceRole.entities.Package.filter(
        { tracking_number: candidate, client_email: clientEmail, status: 'pre_alerta' },
        '-created_date', 1
      );
      if (matches?.[0]) {
        existingPkg = matches[0];
        break;
      }
    }

    if (existingPkg) {
      // 2) Merge: marcar la pre-alerta del cliente como recibida.
      //    Preservar fotos existentes + agregar la nueva.
      const existingPhotos = Array.isArray(existingPkg.package_image_urls)
        ? existingPkg.package_image_urls
        : (existingPkg.package_image_url ? [existingPkg.package_image_url] : []);
      const mergedPhotos = photoUrl
        ? Array.from(new Set([...existingPhotos, photoUrl])).slice(0, 3)
        : existingPhotos;

      await base44.asServiceRole.entities.Package.update(existingPkg.id, {
        status: 'recibido',
        received_date: now,
        received_by: user.email,
        package_image_url: photoUrl || existingPkg.package_image_url || null,
        package_image_urls: mergedPhotos,
      });

      return Response.json({
        action: 'merged',
        package_id: existingPkg.id,
        tracking_number: existingPkg.tracking_number,
      });
    }

    // 3) No hay pre-alerta del cliente → crear la pre-alerta rápida (comportamiento actual)
    const created = await base44.asServiceRole.entities.Package.create({
      tracking_number: tracking,
      client_email: clientEmail,
      shipping_type: shippingType,
      description: 'Pre-alerta rápida',
      status: 'pre_alerta',
      reported: true,
      ...(photoUrl ? { package_image_url: photoUrl, package_image_urls: [photoUrl] } : {}),
    });

    return Response.json({
      action: 'created',
      package_id: created.id,
      tracking_number: tracking,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}