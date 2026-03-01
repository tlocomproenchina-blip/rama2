import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.25.0';

function getStripeSecretKey() {
  return (
    Deno.env.get('STRIPE_SECRET_KEY') ||
    Deno.env.get('CLAVESECRETA') ||
    Deno.env.get('STRIPEAPI') ||
    Deno.env.get('STRIPE_SECRET') ||
    null
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const invoiceId = payload.invoiceId || payload.base44InvoiceId || null;
    const stripeInvoiceIdFromPayload = payload.stripeInvoiceId || null;

    if (!invoiceId && !stripeInvoiceIdFromPayload) {
      return Response.json({ ok: false, error: 'Missing invoice identifiers' }, { status: 400 });
    }

    // Load internal invoice if needed
    let inv = null;
    if (invoiceId) {
      const found = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
      inv = found?.[0] || null;
    }

    const stripeInvoiceId = stripeInvoiceIdFromPayload || inv?.stripe_invoice_id || null;

    if (!stripeInvoiceId) {
      // Nothing to do on Stripe; treat as success but indicate skip
      return Response.json({ ok: true, skipped: true, reason: 'No stripe_invoice_id on record' });
    }

    // Stripe client
    const secret = getStripeSecretKey();
    if (!secret) {
      return Response.json({ ok: false, error: 'Missing STRIPE secret key' }, { status: 500 });
    }
    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' });

    try {
      // Mark as paid out of band on Stripe
      const paidInvoice = await stripe.invoices.pay(stripeInvoiceId, {
        paid_out_of_band: true,
      });

      // Update local record proactively (webhook will also confirm)
      if (inv || invoiceId) {
        const toUpdate = {
          status: 'pagada',
          payment_date: new Date().toISOString(),
          payment_method: 'stripe_invoice',
          payment_reference: paidInvoice.id,
          stripe_invoice_id: paidInvoice.id,
          stripe_hosted_invoice_url: paidInvoice.hosted_invoice_url || undefined,
          stripe_invoice_pdf_url: paidInvoice.invoice_pdf || undefined,
          subtotal: (paidInvoice.subtotal || 0) / 100,
          tax: (paidInvoice.tax || 0) / 100,
          total: (paidInvoice.total || 0) / 100,
        };
        const targetId = invoiceId || inv?.id;
        if (targetId) {
          await base44.asServiceRole.entities.Invoice.update(targetId, toUpdate);
        }
      }

      return Response.json({ ok: true, stripe_invoice_id: paidInvoice.id });
    } catch (err) {
      // Keep app as paid per user choice, but alert discrepancy to current admin
      try {
        await base44.entities.Notification.create({
          user_email: user.email,
          title: 'Stripe no pudo marcar la factura como pagada',
          message: (err?.message || 'Error desconocido'),
          type: 'system',
          icon: 'alert',
          reference_id: stripeInvoiceId,
        });
      } catch (_) {}

      return Response.json({ ok: false, error: err?.message || 'Stripe error' }, { status: 200 });
    }
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});