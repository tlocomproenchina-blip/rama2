import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

// Despacha un bulto completo: marca todos sus paquetes como 'despachado',
// actualiza el bulto a 'despachado', crea el DispatchOrder y notifica al cliente.
// Recibe: { label_code, closed_at? }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { label_code, closed_at } = body;
    if (!label_code) return Response.json({ error: 'label_code es requerido' }, { status: 400 });

    // Buscar el bulto por label_code
    const bultos = await base44.asServiceRole.entities.Bulto.filter({ label_code }, '-created_date', 1);
    const bulto = bultos?.[0];
    if (!bulto) return Response.json({ error: 'Bulto no encontrado', not_found: true }, { status: 404 });

    if (bulto.status === 'despachado') {
      return Response.json({ success: true, already_dispatched: true, bulto });
    }

    const packageIds = Array.isArray(bulto.package_ids) ? bulto.package_ids.filter(Boolean) : [];
    let packageTrackings = Array.isArray(bulto.package_trackings) ? bulto.package_trackings.filter(Boolean) : [];
    const now = closed_at || new Date().toISOString();

    // Si package_trackings está vacío pero hay package_ids, cargar los trackings
    // desde los paquetes reales (fix para bultos creados en lote sin package_trackings)
    if (!packageTrackings.length && packageIds.length) {
      try {
        const packages = await Promise.all(
          packageIds.map((id) => base44.asServiceRole.entities.Package.get(id).catch(() => null))
        );
        packageTrackings = packages.filter(Boolean).map((p: any) => p.tracking_number).filter(Boolean);
      } catch (_) {}
    }

    // Marcar todos los paquetes como despachados
    if (packageIds.length) {
      try {
        await base44.asServiceRole.entities.Package.bulkUpdate(
          packageIds.map((id) => ({
            id,
            status: 'despachado',
            dispatched_date: now,
            dispatched_by: user.email,
          }))
        );
      } catch (_) {}
    }

    // Actualizar el bulto a despachado
    const updatedBulto = await base44.asServiceRole.entities.Bulto.update(bulto.id, {
      status: 'despachado',
    });

    // Cargar datos del cliente
    let client: any = null;
    try {
      const users = await base44.asServiceRole.entities.User.filter({ email: bulto.client_email });
      client = users?.[0] || null;
    } catch (_) {}

    // Crear la orden de despacho
    try {
      const items = packageTrackings.map((t) => ({ tracking_number: t }));
      const orderNotes = (!packageTrackings.length && !packageIds.length)
        ? 'Bulto vacío despachado intencionalmente (sin paquetes)'
        : '';
      await base44.functions.invoke('createDispatchOrder', {
        client_email: bulto.client_email,
        client_name: client?.full_name || bulto.client_email,
        shipping_mark: bulto.shipping_mark || '',
        client_snapshot: bulto.client_snapshot || {},
        items,
        created_by_email: user.email,
        notes: orderNotes,
      });
    } catch (_) {}

    // Notificar al cliente
    try {
      const clientName = client?.full_name || (bulto.client_email ? bulto.client_email.split('@')[0] : 'Cliente');
      const displayLabel = bulto.label_code || '(sin etiqueta)';
      const notifTitle = '🚚 Transportista asignado';
      const notifMessage = `Tu bulto ${displayLabel} con ${packageIds.length} paquete(s) fue despachado del almacén. Un transportista fue asignado y tu envío va en camino.`;

      await base44.asServiceRole.entities.Notification.create({
        user_email: bulto.client_email,
        title: notifTitle,
        message: notifMessage,
        type: 'package',
        priority: 'normal',
        reference_id: bulto.id,
        entity_type: 'Bulto',
        icon: 'truck'
      });

      // Email (respeta kill-switch global y modo demo)
      let cfg: any = null;
      try {
        const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
        cfg = configs?.[0];
      } catch (_) {}
      const emailsEnabled = cfg?.emails_enabled !== false;
      const demoMode = cfg?.demo_mode === true;
      if (emailsEnabled && !demoMode && bulto.client_email) {
        const emailBody =
          `<p>Hola <strong>${clientName}</strong>,</p>` +
          `<p>Te informamos que tu bulto <strong>${displayLabel}</strong> con ${packageIds.length} paquete(s) fue despachado de nuestro almacén.</p>` +
          `<p>🚚 <strong>Transportista asignado</strong>: tu envío va en camino a su destino.</p>` +
          `<p>Gracias por confiar en TLEC CARGO.</p>`;
        try {
          await sendBrevoEmail(base44, {
            to: bulto.client_email,
            subject: '🚚 Transportista asignado — tu bulto fue despachado',
            body: emailBody,
            from_name: 'TLEC CARGO',
            source: 'dispatch_assigned',
          });
        } catch (_) {}
      }
    } catch (_) {}

    return Response.json({
      success: true,
      bulto: updatedBulto,
      dispatched_packages: packageIds.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}