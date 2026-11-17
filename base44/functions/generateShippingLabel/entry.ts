import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Soporte puede generar la etiqueta a nombre de cualquier cliente.
    // Sin client_email, la etiqueta es del propio usuario (flujo del cliente).
    let owner = user;
    const targetEmail = String(body.client_email || '').trim().toLowerCase();
    if (targetEmail && targetEmail !== String(user.email || '').toLowerCase()) {
      const isStaff = user.role === 'admin' || user.custom_role === 'customer_service';
      if (!isStaff) {
        return Response.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
      }
      const found = await base44.asServiceRole.entities.User.filter({ email: targetEmail }, '-created_date', 1);
      if (!found?.length) {
        return Response.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }
      owner = found[0];
    }

    if (!owner.shipping_mark) {
      return Response.json({
        error: owner === user
          ? 'Necesitas un Shipping Mark asignado para generar etiquetas'
          : 'El cliente no tiene Shipping Mark asignado',
      }, { status: 403 });
    }

    const content = String(body.content || '').trim();
    const dimensions = String(body.dimensions || '').trim();
    const weight = String(body.weight || '').trim();
    const boxCount = Number(body.box_count) || 1;

    if (!content) {
      return Response.json({ error: 'El contenido es requerido' }, { status: 400 });
    }

    // Consultar etiquetas existentes del cliente para calcular el siguiente sufijo
    const existingLabels = await base44.asServiceRole.entities.ShippingLabel.filter(
      { client_email: owner.email },
      '-suffix_number',
      500
    );

    const maxSuffix = existingLabels.reduce((max, label) => {
      return Math.max(max, Number(label.suffix_number) || 0);
    }, 0);

    const nextSuffix = maxSuffix + 1;
    const labelCode = `${owner.shipping_mark}-L${nextSuffix}`;

    // Crear el registro de la etiqueta
    const newLabel = await base44.asServiceRole.entities.ShippingLabel.create({
      label_code: labelCode,
      client_email: owner.email,
      shipping_mark: owner.shipping_mark,
      suffix_number: nextSuffix,
      content,
      dimensions,
      weight,
      has_fbrand: !!body.has_fbrand,
      has_battery: !!body.has_battery,
      has_liquid: !!body.has_liquid,
      has_powder: !!body.has_powder,
      box_count: boxCount,
      status: 'disponible'
    });

    return Response.json({ label: newLabel, label_code: labelCode });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}