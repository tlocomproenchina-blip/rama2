import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    if (!trackingNumber || !packageImageUrl) {
      return Response.json({ error: 'tracking_number y package_image_url son obligatorios' }, { status: 400 });
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
        package_image_url: packageImageUrl,
      });
    } else {
      pkg = await base44.asServiceRole.entities.Package.update(pkg.id, {
        package_image_url: packageImageUrl,
        status: 'recibido',
        received_date: new Date().toISOString(),
        received_by: user.email,
      });
    }

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

    await base44.integrations.Core.SendEmail({
      to: pkg.client_email,
      subject,
      body: message,
      from_name: 'TLEC CARGO'
    });

    return Response.json({ success: true, package: pkg, created: !existing?.[0] });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});