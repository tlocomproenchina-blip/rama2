import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Historial de impresión de etiquetas de un cliente, del lote más reciente al más
// antiguo: lo que el operador ve en Etiquetas de Despacho para reimprimir una
// etiqueta que se perdió o se dañó.
//
// Recibe: { client_email, limit? }
// Devuelve: { logs, total, has_more }
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const clientEmail = String(body.client_email || '').trim();
    if (!clientEmail) return Response.json({ error: 'Falta el cliente' }, { status: 400 });

    const limit = Math.max(1, Math.min(50, Number(body.limit) || 10));

    const logs: any[] = await base44.asServiceRole.entities.LabelPrintLog
      .filter({ client_email: clientEmail }, '-printed_date', limit)
      .catch(() => []);
    const total: number = await base44.asServiceRole.entities.LabelPrintLog
      .count({ client_email: clientEmail })
      .catch(() => 0);

    const list = Array.isArray(logs) ? logs : [];
    return Response.json({ logs: list, total, has_more: list.length < total });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}