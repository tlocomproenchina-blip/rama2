import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { completeClient } from '../../shared/wholesalerIntake.ts';

// Cierra el alta de un cliente del mayorista: el panel crea la cuenta (invitación,
// datos y Shipping Mark) y aquí queda marcado como creado y registrado en el historial.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const clientId = String(body?.client_id || '').trim();
    if (!clientId) return Response.json({ error: 'Falta el cliente a cerrar.' }, { status: 400 });

    const result = await completeClient(base44, clientId, String(body?.shipping_mark || ''), String(body?.note || ''));
    if (!result.ok) return Response.json(result, { status: 404 });
    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}