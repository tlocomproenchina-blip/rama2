import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// Elimina un bulto y recalcula la numeración secuencial de los bultos restantes del cliente.
// Recibe: { bulto_id }
// - Elimina el bulto.
// - Reenumera los bultos restantes del cliente (1, 2, 3...) manteniendo el orden por bulto_number.
// - Actualiza total_bultos en todos los bultos restantes.
// - Regenera label_code con el nuevo número (shipping_mark-B##).
// - No toca los Package records (los paquetes quedan libres para re-empacar).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const bultoId: string = body.bulto_id || '';
    if (!bultoId) return Response.json({ error: 'Falta bulto_id' }, { status: 400 });

    const bulto = await base44.asServiceRole.entities.Bulto.get(bultoId).catch(() => null);
    if (!bulto) return Response.json({ error: 'Bulto no encontrado' }, { status: 404 });

    const clientEmail = bulto.client_email;
    const shippingMark = bulto.shipping_mark || '';

    // Eliminar el bulto
    await base44.asServiceRole.entities.Bulto.delete(bultoId);

    // Reenumerar los bultos restantes del cliente
    const remaining = await base44.asServiceRole.entities.Bulto.filter(
      { client_email: clientEmail }, 'bulto_number', 500
    );

    if (remaining.length > 0) {
      const newTotal = remaining.length;
      const updates = remaining.map((b: any, idx: number) => {
        const newNumber = idx + 1;
        const newLabelCode = `${shippingMark}-B${newNumber}`;
        return {
          id: b.id,
          bulto_number: newNumber,
          total_bultos: newTotal,
          label_code: newLabelCode,
        };
      });
      await base44.asServiceRole.entities.Bulto.bulkUpdate(updates);
    }

    return Response.json({ success: true, remaining_count: remaining.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}