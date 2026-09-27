import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// Crea un bulto (caja física) que agrupa varios paquetes recibidos de un mismo cliente.
// Recibe: { package_ids: string[] }
// - Valida que todos los paquetes sean del mismo cliente y tengan shipping mark.
// - Calcula el número de bulto secuencial (1, 2, 3...) y el total actual.
// - Genera un label_code escaneable (shipping_mark-B##).
// - Snapshot de datos del cliente y estado de factura para imprimir en la etiqueta.
// - Actualiza los bultos previos del cliente para que reflejen el nuevo total.
// Retorna: { bulto, label_code, bulto_number, total_bultos, client_snapshot, invoice_paid, package_trackings }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const packageIds: string[] = Array.isArray(body.package_ids) ? body.package_ids.filter(Boolean) : [];
    if (!packageIds.length) {
      return Response.json({ error: 'Selecciona al menos un paquete' }, { status: 400 });
    }

    // Fetch all selected packages in parallel
    const packageResults = await Promise.all(
      packageIds.map((id) => base44.asServiceRole.entities.Package.get(id).catch(() => null))
    );
    const selectedPackages = packageResults.filter((p) => p) as any[];
    if (!selectedPackages.length) {
      return Response.json({ error: 'No se encontraron los paquetes' }, { status: 404 });
    }

    // Validate same client
    const clientEmail = selectedPackages[0].client_email || '';
    if (!clientEmail) {
      return Response.json({ error: 'Los paquetes no tienen cliente asignado' }, { status: 400 });
    }
    const allSameClient = selectedPackages.every((p) => p.client_email === clientEmail);
    if (!allSameClient) {
      return Response.json({ error: 'Todos los paquetes deben ser del mismo cliente' }, { status: 400 });
    }

    const shippingMark = selectedPackages[0].shipping_mark || '';
    if (!shippingMark) {
      return Response.json({ error: 'El cliente no tiene shipping mark asignado' }, { status: 400 });
    }

    // Count existing bultos for this client to compute the next number
    const existingBultos = await base44.asServiceRole.entities.Bulto.filter(
      { client_email: clientEmail }, 'bulto_number', 500
    );
    const bultoNumber = (existingBultos.length || 0) + 1;
    const labelCode = `${shippingMark}-B${bultoNumber}`;

    // Fetch client data for the label snapshot
    const clients = await base44.asServiceRole.entities.User.filter({ email: clientEmail }, '-created_date', 1);
    const client = clients?.[0] || ({} as any);
    const clientSnapshot = {
      full_name: client.full_name || '',
      email: client.email || clientEmail,
      cedula: client.cedula || '',
      whatsapp: client.whatsapp || '',
      address: client.address || '',
      city: client.city || '',
      state: client.state || '',
      shipping_mark: client.shipping_mark || shippingMark,
    };

    // Fetch latest invoice for the client to snapshot payment status
    const invoices = await base44.asServiceRole.entities.Invoice.filter(
      { client_email: clientEmail }, '-invoice_date', 1
    );
    const latestInvoice = invoices?.[0] || null;
    const invoicePaid = latestInvoice?.status === 'pagada';
    const invoiceStatus = latestInvoice?.status || 'sin_factura';
    const invoiceNumber = latestInvoice?.invoice_number || '';

    // Auto-lookup CbmIngreso order numbers by tracking intersection
    const packageTrackings = selectedPackages.map((p) => p.tracking_number || '').filter(Boolean);
    const cbmOrderNumbers: string[] = [];
    if (packageTrackings.length > 0) {
      try {
        const cbms = await base44.asServiceRole.entities.CbmIngreso.filter(
          { client_email: clientEmail }, '-fecha', 200
        );
        const trackingSet = new Set(packageTrackings);
        for (const c of cbms || []) {
          const tn = Array.isArray(c.tracking_numbers) ? c.tracking_numbers : [];
          if (tn.some((t: string) => trackingSet.has(t)) && c.invoice_number) {
            cbmOrderNumbers.push(c.invoice_number);
          }
        }
      } catch (_) {}
    }

    // Create the bulto record
    const newBulto = await base44.asServiceRole.entities.Bulto.create({
      label_code: labelCode,
      client_email: clientEmail,
      shipping_mark: shippingMark,
      bulto_number: bultoNumber,
      total_bultos: bultoNumber,
      package_ids: packageIds,
      package_trackings: packageTrackings,
      cbm_order_numbers: cbmOrderNumbers,
      client_snapshot: clientSnapshot,
      invoice_paid: invoicePaid,
      invoice_status: invoiceStatus,
      invoice_number: invoiceNumber,
      warehouse_id: selectedPackages[0].warehouse_id || '',
      status: 'activo',
      created_by: user.email || '',
    });

    // Update all previous bultos of this client to reflect the new total
    if (existingBultos.length > 0) {
      try {
        await base44.asServiceRole.entities.Bulto.bulkUpdate(
          existingBultos.map((b) => ({ id: b.id, total_bultos: bultoNumber }))
        );
      } catch (_) {}
    }

    return Response.json({
      bulto: newBulto,
      label_code: labelCode,
      bulto_number: bultoNumber,
      total_bultos: bultoNumber,
      client_snapshot: clientSnapshot,
      invoice_paid: invoicePaid,
      invoice_status: invoiceStatus,
      invoice_number: invoiceNumber,
      package_trackings: selectedPackages.map((p) => p.tracking_number || '').filter(Boolean),
      cbm_order_numbers: cbmOrderNumbers,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}