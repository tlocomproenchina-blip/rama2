import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { confirmReceptionToWholesaler, noticeDeliveredWithPhoto, setOrphanFollowup } from '../../shared/wholesalerNotify.ts';

async function hasWarehouseAccess(base44, user, allowedPages) {
  if (user?.role === 'admin') return true;
  if (['warehouse', 'operations_manager'].includes(user?.custom_role)) return true;
  if (!user?.custom_role) return false;
  const roles = await base44.asServiceRole.entities.RoleConfig.filter({ role_code: user.custom_role, is_active: true }, '-updated_date', 1);
  const role = roles?.[0];
  const visiblePages = role?.visible_pages || [];
  return allowedPages.some((page) => visiblePages.includes(page));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await hasWarehouseAccess(base44, user, ['WarehouseReceive', 'WarehouseLocations']))) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const trackingNumber = String(body?.tracking_number || '').trim();
    const clientEmail = String(body?.client_email || '').trim();
    const packageImageUrl = String(body?.package_image_url || '').trim();
    const bodyUrls = Array.isArray(body?.package_image_urls)
      ? body.package_image_urls.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 3)
      : [];
    const imageUrls = bodyUrls.length ? bodyUrls : (packageImageUrl ? [packageImageUrl] : []);
    const skipEmail = body?.skip_email === true;

    if (!trackingNumber) {
      return Response.json({ error: 'tracking_number es obligatorio' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.Package.filter({ tracking_number: trackingNumber }, '-created_date', 1);
    let pkg = existing?.[0] || null;

    if (!pkg) {
      if (!clientEmail) {
        return Response.json({ error: 'client_email es obligatorio para crear un paquete nuevo' }, { status: 400 });
      }

      const clientRows = await base44.asServiceRole.entities.User.filter({ email: clientEmail }, '-created_date', 1);
      const client = clientRows?.[0] || null;

      pkg = await base44.asServiceRole.entities.Package.create({
        tracking_number: trackingNumber,
        client_email: clientEmail,
        shipping_mark: client?.shipping_mark || '',
        shipping_type: 'maritimo',
        description: 'Paquete recibido sin pre-alerta',
        status: 'recibido',
        reported: true,
        received_date: new Date().toISOString(),
        received_by: user.email,
        package_image_url: imageUrls[0] || null,
        package_image_urls: imageUrls,
      });
    } else {
      pkg = await base44.asServiceRole.entities.Package.update(pkg.id, {
        package_image_url: imageUrls[0] || pkg.package_image_url || null,
        package_image_urls: imageUrls.length
          ? imageUrls
          : (Array.isArray(pkg.package_image_urls) ? pkg.package_image_urls : (pkg.package_image_url ? [pkg.package_image_url] : [])),
        status: 'recibido',
        received_date: new Date().toISOString(),
        received_by: user.email,
      });
    }

    // Recepción confirmada al mayorista con la foto del almacén: su cuenta del
    // cliente recibe el tracking con la foto. Si el aviso sale completo, la carga
    // deja de aparecer en seguimiento dentro de Paquetes Huérfanos; si falla o la
    // foto todavía no existe, queda pendiente y se reintenta en el corte siguiente.
    let avisoMayorista = null;
    try {
      avisoMayorista = await confirmReceptionToWholesaler(base44, pkg, `recibido en almacén por ${user.email}`);
      if (noticeDeliveredWithPhoto(avisoMayorista)) await setOrphanFollowup(base44, pkg.id, false);
    } catch (_) {}

    const subject = '📥 Paquete recibido en warehouse';
    const message = `Tu paquete ${pkg.tracking_number} ha sido recibido en nuestro almacén.`;

    await base44.asServiceRole.entities.Notification.create({
      user_email: pkg.client_email,
      title: subject,
      message,
      type: 'package',
      priority: 'high',
      reference_id: pkg.id || pkg.tracking_number,
      entity_type: 'Package',
      icon: 'package',
      read: false
    });

    // Email desactivado para reducir consumo de créditos de integraciones.
    // La notificación in-app sigue activa (creada arriba). Para reactivar, restaurar el bloque SendEmail.
    const emailSent = false;

    return Response.json({ success: true, package: pkg, created: !existing?.[0], email_sent: emailSent, aviso_mayorista: avisoMayorista });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});