import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!user.shipping_mark) {
      return Response.json({ error: 'Necesitas un Shipping Mark asignado para generar etiquetas' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const content = String(body.content || '').trim();
    const dimensions = String(body.dimensions || '').trim();
    const weight = String(body.weight || '').trim();
    const boxCount = Number(body.box_count) || 1;

    if (!content) {
      return Response.json({ error: 'El contenido es requerido' }, { status: 400 });
    }

    // Consultar etiquetas existentes del cliente para calcular el siguiente sufijo
    const existingLabels = await base44.asServiceRole.entities.ShippingLabel.filter(
      { client_email: user.email },
      '-suffix_number',
      500
    );

    const maxSuffix = existingLabels.reduce((max, label) => {
      return Math.max(max, Number(label.suffix_number) || 0);
    }, 0);

    const nextSuffix = maxSuffix + 1;
    const labelCode = `${user.shipping_mark}-L${nextSuffix}`;

    // Crear el registro de la etiqueta
    const newLabel = await base44.asServiceRole.entities.ShippingLabel.create({
      label_code: labelCode,
      client_email: user.email,
      shipping_mark: user.shipping_mark,
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