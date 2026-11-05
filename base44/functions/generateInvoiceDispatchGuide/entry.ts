import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { createInvoiceDispatchGuide } from '../../shared/invoiceDispatchGuide.ts';

// Emite una guía de despacho nueva con todos los bultos de una factura.
// mode 'auto' (workflow al quedar pagada, una sola vez por factura) o 'manual'
// (botón en Gestión de Facturas; request_key evita duplicar un reintento).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body.invoice_id || '').trim();
    if (!invoiceId) return Response.json({ error: 'invoice_id es requerido' }, { status: 400 });
    const mode = body.mode === 'auto' ? 'auto' : 'manual';
    const requestKey = String(body.request_key || '').trim();

    const result: any = await createInvoiceDispatchGuide(base44, { invoiceId, mode, requestKey, user });
    if (result?.status) return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}