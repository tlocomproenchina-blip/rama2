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

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

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
      return Response.json({ ok: true, skipped: true, reason: 'No stripe_invoice_id on record' });
    }

    // Load config for modes
    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const cfg = cfgs?.[0] || {};
    const detailsMode = cfg.payments_stripe_details_mode || 'none';
    const errorMode = cfg.payments_stripe_error_mode || 'keep_and_alert';

    const secret = getStripeSecretKey();
    if (!secret) return Response.json({ ok: false, error: 'Missing STRIPE secret key' }, { status: 500 });
    const stripe = new Stripe(secret, { apiVersion: '2023-10-16' });

    const applyDetailsIfNeeded = async () => {
      if (detailsMode === 'none') return;
      try {
        if (detailsMode === 'metadata') {
          await stripe.invoices.update(stripeInvoiceId, {
            metadata: {
              oob_paid: 'true',
              app_invoice_id: invoiceId || inv?.id || '',
              marked_by: user.email || '',
              marked_at: new Date().toISOString()
            }
          });
        } else if (detailsMode === 'description') {
          const note = `OOB paid via admin by ${user.email} at ${new Date().toISOString()}`;
          await stripe.invoices.update(stripeInvoiceId, { description: note });
        }
      } catch (_) {
        // Do not block on details write
      }
    };

    const performPay = async () => {
      await applyDetailsIfNeeded();
      const paidInvoice = await stripe.invoices.pay(stripeInvoiceId, { paid_out_of_band: true });
      return paidInvoice;
    };

    let paidInvoice = null;
    try {
      paidInvoice = await performPay();
    } catch (err) {
      if (errorMode === 'retry_then_revert') {
        try {
          paidInvoice = await performPay();
        } catch (err2) {
          // Notify admin of discrepancy
          try {
            await base44.entities.Notification.create({
              user_email: user.email,
              title: 'Stripe no pudo marcar la factura como pagada',
              message: err2?.message || 'Error desconocido',
              type: 'system',
              icon: 'alert',
              reference_id: stripeInvoiceId,
            });
          } catch (_) {}
          return Response.json({ ok: false, error: err2?.message || 'Stripe error (retry failed)' }, { status: 200 });
        }
      } else {
        try {
          await base44.entities.Notification.create({
            user_email: user.email,
            title: 'Stripe no pudo marcar la factura como pagada',
            message: err?.message || 'Error desconocido',
            type: 'system',
            icon: 'alert',
            reference_id: stripeInvoiceId,
          });
        } catch (_) {}
        return Response.json({ ok: false, error: err?.message || 'Stripe error' }, { status: 200 });
      }
    }

    // Update local record proactively (webhook will also confirm)
    try {
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
    } catch (_) {}

    return Response.json({ ok: true, stripe_invoice_id: paidInvoice.id });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});