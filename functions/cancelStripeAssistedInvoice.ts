import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
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

    // Require admin auth
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    let payload = {};
    try { payload = await req.json(); } catch { payload = {}; }

    const assistedId = payload.assisted_request_id;
    const cancelReason = payload.reason || 'Cancelación de factura solicitada por el administrador';
    if (!assistedId) {
      return Response.json({ error: 'Missing assisted_request_id' }, { status: 400 });
    }

    // Load request and config for email content
    const [reqs, cfgArr] = await Promise.all([
      base44.asServiceRole.entities.AssistedPaymentRequest.filter({ id: assistedId }),
      base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }).catch(() => [])
    ]);
    if (!reqs || reqs.length === 0) {
      return Response.json({ error: 'Assisted request not found' }, { status: 404 });
    }
    const ap = reqs[0];
    const appName = cfgArr?.[0]?.app_name || 'TLEC CARGO';

    const stripeSecret = getStripeSecretKey();
    let stripe;
    if (stripeSecret) {
      stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });
    }

    let stripeAction = 'no_op';
    let stripeInvoiceId = null;
    let hostedUrl = null;
    let paid = false;

    if (stripe) {
      try {
        // Find latest Stripe invoice created for this assisted request via metadata
        const search = await stripe.invoices.search({
          query: `metadata['assisted_payment_request_id']:'${assistedId}'`,
          limit: 1,
        });
        const invoice = search?.data?.[0] || null;
        if (invoice) {
          stripeInvoiceId = invoice.id;
          hostedUrl = invoice.hosted_invoice_url || null;
          switch (invoice.status) {
            case 'draft':
              await stripe.invoices.del(invoice.id);
              stripeAction = 'deleted_draft';
              break;
            case 'open':
            case 'uncollectible':
              await stripe.invoices.voidInvoice(invoice.id);
              stripeAction = 'voided';
              break;
            case 'paid':
              paid = true;
              stripeAction = 'paid_cannot_cancel';
              break;
            case 'void':
              stripeAction = 'already_void';
              break;
            default:
              stripeAction = `no_action_status_${invoice.status}`;
          }
        }
      } catch (e) {
        // Ignore Stripe errors but continue to notify user via email
        stripeAction = 'stripe_error';
      }
    }

    // Append admin comment for traceability
    try {
      const note = `Factura cancelada${stripeInvoiceId ? ` (Stripe ${stripeInvoiceId})` : ''} – ${new Date().toISOString()}`;
      const admin_comment = [ap.admin_comment, note].filter(Boolean).join(' | ');
      await base44.asServiceRole.entities.AssistedPaymentRequest.update(ap.id, { admin_comment });
    } catch {}

    // Email notification to client (always send a cancel notification)
    const subject = `${appName} – Factura de Pago Asistido cancelada`;
    const body = `Hola,\n\nTu factura de Pago Asistido ha sido cancelada.\n\n` +
      `ID de solicitud: ${ap.id}\n` +
      (ap.link_url ? `Enlace del proveedor: ${ap.link_url}\n` : '') +
      (stripeInvoiceId ? `ID de factura Stripe: ${stripeInvoiceId}\n` : '') +
      (hostedUrl ? `URL de la factura: ${hostedUrl}\n` : '') +
      `Motivo: ${cancelReason}\n\n` +
      `Si necesitas continuar con el proceso, por favor crea una nueva solicitud o espera nuevas instrucciones.`;

    try {
      await base44.integrations.Core.SendEmail({
        to: ap.client_email,
        subject,
        body,
        from_name: appName,
      });
    } catch {}

    return Response.json({ success: true, stripe_action: stripeAction, stripe_invoice_id: stripeInvoiceId, paid });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
});