import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { bultoScanProjection } from '../../shared/bultoScan.ts';

// Busca un bulto por su label_code (escaneado desde la etiqueta térmica).
// Recibe: { label_code: string }
// Accesible SIN sesión (igual que las funciones del almacén de China): la pantalla
// /BultoOrderScan se comparte como enlace directo de trabajo, sin login.
// Devuelve únicamente los campos que esa pantalla muestra, más el estado de la
// factura más reciente del cliente.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const labelCode = String(body.label_code || '').trim();
    if (!labelCode) {
      return Response.json({ error: 'label_code requerido' }, { status: 400 });
    }

    const bultos = await base44.asServiceRole.entities.Bulto.filter(
      { label_code: labelCode }, '-created_date', 1
    );
    const found = bultos?.[0];
    if (!found) {
      return Response.json({ error: 'Bulto no encontrado' }, { status: 404 });
    }

    // Fresh invoice status (in case it changed since the bulto was created)
    const invoices = await base44.asServiceRole.entities.Invoice.filter(
      { client_email: found.client_email }, '-invoice_date', 1
    );
    const latestInvoice = invoices?.[0] || null;

    // Proyección compartida: solo lo que muestran las pantallas de escaneo.
    const bulto = bultoScanProjection(found);

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