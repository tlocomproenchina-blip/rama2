import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

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

    // Proyección: solo lo que muestran las pantallas de escaneo/verificación.
    const snap = found.client_snapshot || {};
    const bulto = {
      id: found.id,
      label_code: found.label_code,
      shipping_mark: found.shipping_mark,
      client_email: found.client_email,
      client_snapshot: {
        full_name: snap.full_name || '',
        cedula: snap.cedula || '',
        whatsapp: snap.whatsapp || '',
        address: snap.address || '',
        city: snap.city || '',
        state: snap.state || '',
      },
      bulto_number: found.bulto_number,
      total_bultos: found.total_bultos,
      status: found.status,
      package_count: (found.package_ids || []).length,
      package_trackings: found.package_trackings || [],
      cbm_order_numbers: found.cbm_order_numbers || [],
      order_locked: !!found.order_locked,
      order_assigned_by: found.order_assigned_by || '',
    };

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