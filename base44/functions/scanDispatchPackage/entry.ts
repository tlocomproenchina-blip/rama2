import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo personal autorizado' }, { status: 403 });

    const { tracking_number } = await req.json();
    const tracking = (tracking_number || '').trim();
    if (!tracking) return Response.json({ error: 'tracking_number requerido' }, { status: 400 });

    const matches = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking });
    const pkg = matches?.[0];
    if (!pkg) {
      return Response.json({ error: 'Paquete no encontrado en el sistema', not_found: true }, { status: 404 });
    }

    const previousStatus = pkg.status;
    if (previousStatus === 'despachado') {
      // Ya fue despachado: solo informar, no volver a marcar
      let clientDup = null;
      try {
        const usersDup = await base44.asServiceRole.entities.User.filter({ email: pkg.client_email });
        clientDup = usersDup?.[0] || null;
      } catch (_) {}
      return Response.json({
        success: true,
        already_dispatched: true,
        auto_received: false,
        previous_status: previousStatus,
        package: {
          id: pkg.id,
          tracking_number: pkg.tracking_number,
          description: pkg.description,
          shipping_type: pkg.shipping_type,
          client_email: pkg.client_email,
          shipping_mark: pkg.shipping_mark,
          dispatched_date: pkg.dispatched_date
        },
        client: clientDup ? {
          full_name: clientDup.full_name,
          email: clientDup.email,
          shipping_mark: clientDup.shipping_mark,
          city: clientDup.city
        } : null
      });
    }

    const now = new Date().toISOString();
    const autoReceived = previousStatus === 'pre_alerta';
    const updates = {
      status: 'despachado',
      dispatched_date: now,
      dispatched_by: user.email
    };
    if (autoReceived) {
      // No estaba recibido: se registra la recepción en este momento para que no quede pendiente
      updates.received_date = now;
      updates.received_by = user.email;
    }
    await base44.asServiceRole.entities.Package.update(pkg.id, updates);

    let client = null;
    try {
      const users = await base44.asServiceRole.entities.User.filter({ email: pkg.client_email });
      client = users?.[0] || null;
    } catch (_) {}

    return Response.json({
      success: true,
      already_dispatched: false,
      auto_received: autoReceived,
      previous_status: previousStatus,
      package: {
        id: pkg.id,
        tracking_number: pkg.tracking_number,
        description: pkg.description,
        shipping_type: pkg.shipping_type,
        client_email: pkg.client_email,
        shipping_mark: pkg.shipping_mark || client?.shipping_mark,
        dispatched_date: now
      },
      client: client ? {
        full_name: client.full_name,
        email: client.email,
        shipping_mark: client.shipping_mark,
        city: client.city
      } : null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});