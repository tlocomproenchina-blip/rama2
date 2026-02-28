import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.25.0';

// Helper: fetch Stripe secret from any of the possible env names already used in the app
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
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Raw body and signature for webhook verification
    const rawBody = await req.text();
    const sig = req.headers.get('stripe-signature') || req.headers.get('Stripe-Signature');
    const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!endpointSecret) {
      return Response.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 });
    }

    const stripeSecret = getStripeSecretKey() || '';
    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' });

    let event;
    try {
      // IMPORTANT for Deno: use async version
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, endpointSecret);
    } catch (err) {
      console.error('⚠️  Webhook signature verification failed.', err?.message || err);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Only initialize Base44 client AFTER verifying Stripe authenticity
    const base44 = createClientFromRequest(req);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi: any = event.data.object;
        // Resolve our Base44 invoice id from metadata or the linked Stripe invoice
        let base44Id = pi?.metadata?.base44_invoice_id || pi?.metadata?.invoice_id || null;
        if (!base44Id && pi?.invoice) {
          try {
            const stripeInv = await stripe.invoices.retrieve(typeof pi.invoice === 'string' ? pi.invoice : pi.invoice.id);
            base44Id = stripeInv?.metadata?.base44_invoice_id || null;
          } catch (e) {
            console.error('Failed to retrieve Stripe invoice for PI mapping:', e);
          }
        }

        if (base44Id) {
          try {
            // Update invoice basic paid info
            await base44.asServiceRole.entities.Invoice.update(base44Id, {
              status: 'pagada',
              payment_date: new Date().toISOString(),
              payment_method: 'stripe',
              payment_reference: pi.id,
              stripe_payment_intent_id: pi.id,
            });

            // Build payment history record
            let chargeId = pi.latest_charge || (pi.charges?.data?.[0]?.id ?? null);
            let brand = '', last4 = '', amount = (pi.amount_received || 0) / 100, currency = (pi.currency || 'usd');
            try {
              if (chargeId) {
                const ch = await stripe.charges.retrieve(chargeId);
                const card = ch?.payment_method_details?.card;
                brand = card?.brand || brand;
                last4 = card?.last4 || last4;
                if (!amount && (ch.amount_captured || ch.amount)) amount = (ch.amount_captured || ch.amount) / 100;
                if (!currency && ch.currency) currency = ch.currency;
              }
            } catch (e) {
              console.error('Failed to retrieve charge for PI:', e);
            }

            const paymentRecord = {
              method_brand: brand || (pi.payment_method_types?.[0] || 'card'),
              last4: last4 || '',
              amount_paid: amount || 0,
              currency: (currency || 'usd').toUpperCase(),
              date: new Date((pi.created || Math.floor(Date.now()/1000)) * 1000).toISOString(),
              payment_intent_id: pi.id,
              charge_id: chargeId || ''
            };

            // Append to payment_history if not duplicate
            const existing = await base44.asServiceRole.entities.Invoice.filter({ id: base44Id });
            if (existing && existing[0]) {
              const invRec: any = existing[0];
              const history = Array.isArray(invRec.payment_history) ? invRec.payment_history : [];
              const dup = history.find((h: any) => h.charge_id === paymentRecord.charge_id || h.payment_intent_id === paymentRecord.payment_intent_id);
              if (!dup) {
                await base44.asServiceRole.entities.Invoice.update(base44Id, { payment_history: [...history, paymentRecord] });
              }
            }
          } catch (e) {
            console.error('Failed to store payment history (PI succeeded):', e);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const invoiceId = pi?.metadata?.invoice_id;
        if (invoiceId) {
          try {
            await base44.asServiceRole.entities.Invoice.update(invoiceId, {
              // Keep status as is; attach reference for troubleshooting
              payment_reference: pi.id,
              stripe_payment_intent_id: pi.id,
            });
          } catch (e) {
            console.error('Failed to record failed payment on invoice:', e);
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invObj: any = event.data.object;
        const base44Id = invObj?.metadata?.base44_invoice_id;
        if (base44Id) {
          try {
            await base44.asServiceRole.entities.Invoice.update(base44Id, {
              status: 'pagada',
              payment_date: new Date().toISOString(),
              payment_method: 'stripe_invoice',
              payment_reference: invObj.id,
              stripe_invoice_id: invObj.id,
              stripe_hosted_invoice_url: invObj.hosted_invoice_url || undefined,
              stripe_invoice_pdf_url: invObj.invoice_pdf || undefined,
              subtotal: (invObj.subtotal || 0) / 100,
              tax: (invObj.tax || 0) / 100,
              total: (invObj.total || 0) / 100
            });

            // Enrich with card details from the underlying PaymentIntent and store in payment_history
            if (invObj.payment_intent) {
              try {
                const pi = await stripe.paymentIntents.retrieve(invObj.payment_intent);
                const chargeId = (pi as any).latest_charge || (pi as any).charges?.data?.[0]?.id || null;
                let brand = '', last4 = '', amount = ((pi as any).amount_received || 0) / 100, currency = ((pi as any).currency || 'usd');
                if (chargeId) {
                  const ch = await stripe.charges.retrieve(chargeId);
                  const card = ch?.payment_method_details?.card;
                  brand = card?.brand || brand;
                  last4 = card?.last4 || last4;
                  if (!amount && (ch.amount_captured || ch.amount)) amount = (ch.amount_captured || ch.amount) / 100;
                  if (!currency && ch.currency) currency = ch.currency;
                }

                const paymentRecord = {
                  method_brand: brand || ((pi as any).payment_method_types?.[0] || 'card'),
                  last4: last4 || '',
                  amount_paid: amount || 0,
                  currency: (currency || 'usd').toUpperCase(),
                  date: new Date((((pi as any).created || Math.floor(Date.now()/1000)) * 1000)).toISOString(),
                  payment_intent_id: (pi as any).id,
                  charge_id: chargeId || ''
                };

                const existing = await base44.asServiceRole.entities.Invoice.filter({ id: base44Id });
                if (existing && existing[0]) {
                  const invRec: any = existing[0];
                  const history = Array.isArray(invRec.payment_history) ? invRec.payment_history : [];
                  const dup = history.find((h: any) => h.charge_id === paymentRecord.charge_id || h.payment_intent_id === paymentRecord.payment_intent_id);
                  if (!dup) {
                    await base44.asServiceRole.entities.Invoice.update(base44Id, { payment_history: [...history, paymentRecord] });
                  }
                }
              } catch (e) {
                console.error('Failed to append payment history from invoice.paid:', e);
              }
            }
          } catch (e) {
            console.error('Failed to update invoice (invoice.paid):', e);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invObj: any = event.data.object;
        const base44Id = invObj?.metadata?.base44_invoice_id;
        if (base44Id) {
          try {
            await base44.asServiceRole.entities.Invoice.update(base44Id, {
              // keep status, just record reference
              payment_reference: invObj.id,
            });
          } catch (e) {
            console.error('Failed to record failed stripe invoice:', e);
          }
        }
        break;
      }

      default: {
        // No-op for other event types
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});