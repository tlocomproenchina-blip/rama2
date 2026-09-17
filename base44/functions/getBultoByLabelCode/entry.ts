import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// Busca un bulto por su label_code (escaneado desde la etiqueta térmica).
// Recibe: { label_code: string }
// Retorna el bulto + estado de pago de factura actualizado en tiempo real.
// Usado por la pantalla de verificación al escanear el barcode CODE128.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const labelCode = String(body.label_code || '').trim();
    if (!labelCode) {
      return Response.json({ error: 'label_code requerido' }, { status: 400 });
    }

    const bultos = await base44.asServiceRole.entities.Bulto.filter(
      { label_code: labelCode }, '-created_date', 1
    );
    const bulto = bultos?.[0];
    if (!bulto) {
      return Response.json({ error: 'Bulto no encontrado' }, { status: 404 });
    }

    // Fresh invoice status (in case it changed since the bulto was created)
    const invoices = await base44.asServiceRole.entities.Invoice.filter(
      { client_email: bulto.client_email }, '-invoice_date', 1
    );
    const latestInvoice = invoices?.[0] || null;

    return Response.json({
      bulto,
      invoice_paid: latestInvoice?.status === 'pagada',
      invoice_status: latestInvoice?.status || 'sin_factura',
      invoice_number: latestInvoice?.invoice_number || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}