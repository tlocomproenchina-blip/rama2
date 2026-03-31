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

    // Auth: admin only
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    let payload = {} as any;
    try { payload = await req.json(); } catch {}

    const invoiceId = payload.invoice_id;
    if (!invoiceId) return Response.json({ error: 'Missing invoice_id' }, { status: 400 });

    const stripeSecret = getStripeSecretKey();
    if (!stripeSecret) return Response.json({ error: 'Stripe secret key not configured' }, { status: 500 });
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

    // Load our invoice
    const invs = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
    if (!invs || invs.length === 0) return Response.json({ error: 'Invoice not found' }, { status: 404 });
    const inv = invs[0];

    // If there is an existing Stripe invoice, void/delete if possible
    if (inv.stripe_invoice_id) {
      try {
        const sInv = await stripe.invoices.retrieve(inv.stripe_invoice_id);
        if (sInv.status === 'paid') {
          return Response.json({ error: 'Cannot recreate: invoice already paid' }, { status: 400 });
        }
        if (sInv.status === 'draft') {
          // Delete draft invoice
          await stripe.invoices.del(sInv.id);
        } else {
          // Attempt to void open/uncollectible
          await stripe.invoices.voidInvoice(sInv.id);
        }
      } catch (e) {
        // Non-fatal; continue with new creation
        console.warn('Warning: could not void/delete existing invoice', e);
      }
    }

    // Clear old references first (optional)
    try {
      await base44.asServiceRole.entities.Invoice.update(inv.id, {
        stripe_invoice_id: null,
        stripe_hosted_invoice_url: null,
        payment_reference: null,
      });
    } catch {}

    // Recreate via existing function
    const res = await base44.asServiceRole.functions.invoke('createStripeInvoice', { invoice_id: inv.id });
    const data = res?.data || {};

    return Response.json({ success: true, stripe_invoice_id: data.stripe_invoice_id, hosted_invoice_url: data.hosted_invoice_url });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? (error as any).message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
});