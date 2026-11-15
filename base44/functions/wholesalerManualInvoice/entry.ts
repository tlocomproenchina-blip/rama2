import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { connectionKeyOf, connectionLabel, listWholesalerConnections, stampMatches } from '../../shared/wholesalerCore.ts';
import { num } from '../../shared/paginatedFetch.ts';
import {
  HANDLING_FEE,
  clientAmounts,
  invoiceEmailHtml,
  nextInvoiceNumber,
  round2,
  round4,
  sendInvoiceEmail,
} from '../../shared/wholesalerBilling.ts';

// Factura manual a un mayorista: por cada cliente suyo se cargan los CBM
// facturados y la cantidad de paquetes. Se aplican las tarifas de su perfil
// (envío USD/CBM, puerta a puerta USD/CBM y el cargo por paquete) y se guarda
// una copia congelada de todo al emitir.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user || user.role !== 'admin') return Response.json({ error: 'Acceso solo para personal autorizado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const key = String(body?.wholesaler_key || '').trim();
    const items: any[] = Array.isArray(body?.items) ? body.items : [];
    if (!key) return Response.json({ error: 'Elige el mayorista a facturar.' }, { status: 400 });
    if (!items.length) return Response.json({ error: 'Agrega al menos un cliente.' }, { status: 400 });

    const connections = await listWholesalerConnections(base44);
    const live = connections.find((row: any) => connectionKeyOf(row) === key);
    if (!live) return Response.json({ error: 'Ese mayorista no existe.' }, { status: 404 });

    const ids = [...new Set(items.map((i) => String(i?.client_id || '')).filter(Boolean))];
    const found = await base44.asServiceRole.entities.WholesalerClient.filter({ id: { $in: ids } }, '-created_date', ids.length || 1);
    const byId: Record<string, any> = {};
    for (const row of found || []) byId[row.id] = row;

    const ratePerCbm = num(live.rate_per_cbm);
    const doorPerCbm = num(live.door_to_door_per_cbm);
    const clients: any[] = [];
    for (const item of items) {
      const client = byId[String(item?.client_id || '')];
      // Aislamiento: solo se facturan clientes que pertenecen a ese mayorista.
      if (!client || !stampMatches(client, live)) {
        return Response.json({ error: 'Uno de los clientes no pertenece a este mayorista.' }, { status: 400 });
      }
      const cbm = round4(num(item?.cbm));
      const packages = Math.max(0, Math.round(num(item?.packages)));
      if (cbm <= 0 && packages <= 0) {
        return Response.json({ error: `Indica CBM o paquetes para ${client.full_name || client.email}.` }, { status: 400 });
      }
      const amounts = clientAmounts({ cbm, shippingRate: ratePerCbm, doorRate: doorPerCbm, trackings: packages });
      clients.push({
        client_id: client.id,
        client_email: String(client.email || '').toLowerCase(),
        client_name: client.full_name || client.email || '',
        shipping_mark: client.shipping_mark || '',
        rate_per_cbm: round2(ratePerCbm),
        door_to_door_per_cbm: round2(doorPerCbm),
        handling_fee: HANDLING_FEE,
        cbm,
        packages,
        bultos: packages,
        received_trackings: packages,
        shipping_amount: amounts.shipping,
        door_to_door_amount: amounts.doorToDoor,
        handling_amount: amounts.handling,
        total: amounts.total,
        orders: [],
        email_status: 'pendiente',
      });
    }

    const sum = (field: string) => clients.reduce((acc, c) => acc + num(c[field]), 0);
    const totals = {
      clients: clients.length,
      cbm: round4(sum('cbm')),
      bultos: sum('packages'),
      received_trackings: sum('packages'),
      shipping: round2(sum('shipping_amount')),
      door_to_door: round2(sum('door_to_door_amount')),
      handling: round2(sum('handling_amount')),
      total: round2(sum('total')),
    };

    const invoiceNumber = await nextInvoiceNumber(base44);
    const now = new Date().toISOString();
    const wholesalerName = connectionLabel(live);
    const invoiceEmail = String(live.invoice_email || '').trim();
    const invoice = await base44.asServiceRole.entities.WholesalerInvoice.create({
      invoice_number: invoiceNumber,
      billing_mode: 'manual',
      wholesaler_key: key,
      wholesaler_name: wholesalerName,
      invoice_email: invoiceEmail,
      emitted_date: now,
      emitted_by: user.email,
      clients,
      totals,
      status: 'sin_envio',
      notes: String(body?.notes || '').slice(0, 1000),
    });

    let outcome: any = { status: 'omitido', error: 'Se emitió sin enviar correo.' };
    if (body?.send_email !== false) {
      const html = invoiceEmailHtml({ invoiceNumber, emittedDate: now, wholesalerName, clients, totals });
      outcome = invoiceEmail
        ? await sendInvoiceEmail(base44, { to: invoiceEmail, invoiceNumber, html })
        : { status: 'sin_correo', error: 'El mayorista no tiene correo de facturación en su perfil.' };
    }
    const sent = outcome.status === 'enviado';
    await base44.asServiceRole.entities.WholesalerInvoice.update(invoice.id, {
      clients: clients.map((c) => ({ ...c, email_status: outcome.status, email_error: outcome.error || null, email_sent_date: sent ? new Date().toISOString() : null })),
      emails_sent: sent ? 1 : 0,
      emails_failed: outcome.status === 'fallido' ? 1 : 0,
      status: sent ? 'enviada' : 'sin_envio',
    });

    return Response.json({ ok: true, invoice_id: invoice.id, invoice_number: invoiceNumber, totals, email: outcome });
  } catch (error) {
    return Response.json({ error: (error as any)?.message || 'No se pudo emitir la factura.' }, { status: 500 });
  }
}