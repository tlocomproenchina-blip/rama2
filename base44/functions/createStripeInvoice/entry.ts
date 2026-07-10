import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.25.0';

function getStripeSecretKey() {
  return (
    Deno.env.get('STRIPE_SECRET_KEY') ||
    Deno.env.get('STRIPEAPI') ||
    Deno.env.get('stripe_secret_key') ||
    Deno.env.get('STRIPE_SK') ||
    null
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let payload: any = {};
    try { payload = await req.json(); } catch { payload = {}; }

    // Strict auth: payload fields (e.g. event.entity_name) are attacker-controlled
    // and must never be used to bypass authentication. Admin only.
    let authed = null;
    try { authed = await base44.auth.me(); } catch { authed = null; }
    if (!authed) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authed.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const stripeSecret = getStripeSecretKey();
    if (!stripeSecret) {
      return Response.json({ error: 'Stripe secret key not configured' }, { status: 500 });
    }
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

    const invoiceId = payload.invoice_id || payload?.event?.entity_id;
    if (!invoiceId) {
      return Response.json({ error: 'Missing invoice_id' }, { status: 400 });
    }

    // Load our invoice
    const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
    if (!invoices || invoices.length === 0) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const inv = invoices[0];

    // Parallel fetch app config and user
    let dueDays = 7;
    const [cfg, users] = await Promise.all([
      base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }).catch(() => []),
      base44.asServiceRole.entities.User.filter({ email: inv.client_email })
    ]);
    if (cfg && cfg[0]?.invoice_overdue_days) dueDays = cfg[0].invoice_overdue_days;

    if (!users || users.length === 0) {
      return Response.json({ error: 'Client user not found' }, { status: 404 });
    }
    let client = users[0];

    // Ensure Stripe customer exists (use function result when available to avoid refetch)
    if (!client.stripe_customer_id) {
      const resp = await base44.asServiceRole.functions.invoke('createStripeCustomer', { user_id: client.id });
      const maybeId = resp?.data?.stripe_customer_id || resp?.data?.customer_id || resp?.data?.id;
      if (maybeId) {
        client = { ...client, stripe_customer_id: String(maybeId) };
      } else {
        const refreshed = await base44.asServiceRole.entities.User.filter({ id: client.id });
        client = refreshed[0];
      }
    }

    // Create draft Stripe invoice first (attach items directly to this invoice)
    const currency = 'usd';
    const items: Array<any> = Array.isArray(inv.items) ? inv.items : [];

    // Load consolidation and related AP/state in parallel
    let cons: any = null;
    let destinationState = '';
    let cargoTypeLabel = 'General';
    if (inv.consolidation_id) {
      const [consArr, aps] = await Promise.all([
        base44.asServiceRole.entities.Consolidation.filter({ id: inv.consolidation_id }).catch(() => []),
        base44.asServiceRole.entities.AccountsPayable.filter({ related_consolidation_id: inv.consolidation_id }).catch(() => [])
      ]);
      cons = consArr?.[0] || null;
      if (aps && aps.length > 0) {
        const ap = aps[0];
        const code = ap.state_code || '';
        if (code) {
          const st = await base44.asServiceRole.entities.StateConfig.filter({ state_code: code }).catch(() => []);
          if (st && st[0]?.state_name) {
            destinationState = st[0].state_name;
          } else {
            destinationState = String(code).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          }
        }
        if ((ap.risk_level || '').toLowerCase() === 'alto') cargoTypeLabel = 'High Risk';
      }
    }

    const shippingType = (cons?.shipping_type) || (inv.items?.[0]?.description?.toLowerCase().includes('aéreo') ? 'aereo' : 'maritimo');
    const ddpTitle = shippingType === 'aereo' 
      ? 'International Logistics Service – DDP Door to Door (Air Freight)'
      : 'International Logistics Service – DDP Door to Door (Sea Freight)';
    const weightInfo = shippingType === 'aereo'
      ? `Weight: ${cons?.real_weight_kg ?? inv.items?.[0]?.details?.billable_weight ?? 'N/A'} kg`
      : `Weight / CBM: ${cons?.cbm ?? inv.items?.[0]?.details?.dimensions ?? 'N/A'}`;
    const shipmentId = cons?.consolidation_tracking || inv.consolidation_tracking || '';
    const serviceMode = shippingType === 'aereo' ? 'Air Freight (DDP)' : 'Maritime Freight (DDP)';

    // (moved above for parallelization)

    const destinationLine = `Destination: Venezuela${destinationState ? ' – ' + destinationState : ''}`;
    const ddpDetail = `${ddpTitle}\n\nOrigin: China\n${destinationLine}\nService Mode: ${serviceMode}\nCargo Type: ${cargoTypeLabel}\nHandling: Consolidated Shipment\nShipment Reference: ${shipmentId}`;

    const footerTerms = `Service Terms – DDP Door to Door Logistics\n\nThis invoice corresponds to international logistics and freight forwarding services under DDP (Delivered Duty Paid) terms. The service includes freight transportation, customs clearance, applicable import duties/taxes, and final delivery to destination.\n\nThe client authorizes TLEC Cargo LTD to manage customs and shipping procedures on their behalf.\n\nOnce shipment processing or cargo reservation has started, payments are non-refundable except in cases of operational cancellation prior to dispatch.\n\nTracking and shipment reference: ${shipmentId}\n\nFor support: tlocomproenchina@gmail.com | +1 502 694 6833${(inv.total || 0) > 2000 ? '\n\nCommercial shipment – non-personal goods – freight forwarding service' : ''}`;

    const stripeInvoice = await stripe.invoices.create({
      customer: client.stripe_customer_id,
      collection_method: 'send_invoice',
      days_until_due: dueDays,
      metadata: {
        base44_invoice_id: String(inv.id),
        base44_consolidation_id: inv.consolidation_id || '',
      },
      description: ddpDetail,
      footer: `Service Terms – International Logistics (DDP)\n\nThis invoice corresponds to international freight forwarding and logistics services under Delivered Duty Paid (DDP) terms, including freight transportation, customs clearance, applicable import duties and final delivery to destination.\n\nTLEC Cargo LTD acts solely as logistics and freight service provider and does not sell or resell transported goods.\n\nPayments become non-refundable once cargo processing, consolidation or shipment reservation has commenced.`,
      statement_descriptor: 'TLEC CARGO LTD',
      auto_advance: false
    });

    // Attach line items to the draft invoice
    for (const it of items) {
      const amount = Math.round((Number(it.total) || (Number(it.quantity) * Number(it.unit_price) || 0)) * 100);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      await stripe.invoiceItems.create({
        customer: client.stripe_customer_id,
        invoice: stripeInvoice.id,
        amount,
        currency,
        description: it.description || 'Servicio',
      });
    }

    // Add tax line if any
    if (inv.tax && Number(inv.tax) > 0) {
      await stripe.invoiceItems.create({
        customer: client.stripe_customer_id,
        invoice: stripeInvoice.id,
        amount: Math.round(Number(inv.tax) * 100),
        currency,
        description: 'Impuestos',
      });
    }

    // Finalize (NO enviar email todavía)
    const finalized = await stripe.invoices.finalizeInvoice(stripeInvoice.id);

    // Esperar hasta que Stripe tenga lista la hosted_invoice_url (máx ~60s)
    let fresh = await stripe.invoices.retrieve(finalized.id);
    let attempts = 0;
    while (!fresh.hosted_invoice_url && attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000)); // 2s
      fresh = await stripe.invoices.retrieve(finalized.id);
      attempts++;
    }

    // Guardar referencias en nuestra factura (aunque no haya URL tras agotar intentos)
    try {
      await base44.asServiceRole.entities.Invoice.update(inv.id, {
        payment_reference: `stripe:${finalized.id}`,
        stripe_invoice_id: finalized.id,
        stripe_hosted_invoice_url: fresh.hosted_invoice_url || '',
        stripe_invoice_pdf_url: fresh.invoice_pdf || '',
        subtotal: (fresh.subtotal || 0) / 100,
        tax: (fresh.tax || 0) / 100,
        total: (fresh.total || 0) / 100
      });
    } catch {}

    // Enviar el email de Stripe SOLO cuando la URL esté lista (o tras agotar intentos)
    let sent: any = null;
    try {
      sent = await stripe.invoices.sendInvoice(finalized.id);
    } catch (_) {
      // Si falló el envío, igualmente retornamos con la URL para que el panel la muestre
    }

    return Response.json({ success: true, stripe_invoice_id: finalized.id, hosted_invoice_url: fresh.hosted_invoice_url || null, email_sent: !!sent });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? (error as any).message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
});