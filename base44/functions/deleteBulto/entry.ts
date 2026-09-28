import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// Elimina uno o varios bultos y recalcula la numeración secuencial de los bultos restantes de cada cliente.
// Recibe: { bulto_id } o { bulto_ids: [] }
// - Solo la cuenta autorizada puede eliminar bultos (validado en servidor, no en la interfaz).
// - Elimina cada bulto solicitado, sin abortar el resto si alguno falla.
// - Reenumera los bultos restantes de cada cliente afectado (1, 2, 3...) manteniendo el orden por bulto_number.
// - Actualiza total_bultos y regenera label_code (shipping_mark-B##).
// - No toca los Package records (los paquetes quedan libres para re-empacar).
const AUTHORIZED_DELETE_EMAILS = ['genel.agonzalez@gmail.com'];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!AUTHORIZED_DELETE_EMAILS.includes((user.email || '').toLowerCase())) {
      return Response.json({ error: 'Solo la cuenta autorizada puede eliminar bultos' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const bultoIds: string[] = Array.isArray(body.bulto_ids) && body.bulto_ids.length > 0
      ? body.bulto_ids.filter((id: any) => typeof id === 'string' && id)
      : (body.bulto_id ? [body.bulto_id] : []);
    if (!bultoIds.length) return Response.json({ error: 'Falta bulto_id' }, { status: 400 });

    const deleted: any[] = [];
    const failed: any[] = [];
    const affectedClients = new Set<string>();
    const shippingMarks = new Map<string, string>();

    for (const id of bultoIds) {
      try {
        const bulto = await base44.asServiceRole.entities.Bulto.get(id).catch(() => null);
        if (!bulto) {
          failed.push({ id, error: 'Bulto no encontrado' });
          continue;
        }
        await base44.asServiceRole.entities.Bulto.delete(id);
        deleted.push({ id, label_code: bulto.label_code });
        const clientEmail: string = bulto.client_email || '';
        if (clientEmail) {
          affectedClients.add(clientEmail);
          if (bulto.shipping_mark) shippingMarks.set(clientEmail, bulto.shipping_mark);
        }
      } catch (e: any) {
        failed.push({ id, error: e?.message || 'Error al eliminar' });
      }
    }

    // Reenumerar una sola vez los bultos restantes de cada cliente afectado
    for (const clientEmail of affectedClients) {
      const remaining = await base44.asServiceRole.entities.Bulto.filter(
        { client_email: clientEmail }, 'bulto_number', 500
      );

      if (remaining.length === 0) continue;

      const fallbackMark = shippingMarks.get(clientEmail) || '';
      const newTotal = remaining.length;
      const updates = remaining.map((b: any, idx: number) => {
        const mark = b.shipping_mark || fallbackMark;
        return {
          id: b.id,
          bulto_number: idx + 1,
          total_bultos: newTotal,
          label_code: `${mark}-B${idx + 1}`,
        };
      });
      await base44.asServiceRole.entities.Bulto.bulkUpdate(updates);
    }

    return Response.json({
      success: true,
      deleted_count: deleted.length,
      deleted,
      failed,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}