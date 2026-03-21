import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function getPublishableKey() {
  return (
    Deno.env.get('STRIPE_PUBLISHABLE_KEY') ||
    Deno.env.get('STRIPE_PUBLIC_KEY') ||
    Deno.env.get('STRIPEPPUBLICA') ||
    Deno.env.get('stripepublicable') ||
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

    const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const config = configs?.[0] || {};
    if (config.external_services_enabled === false) {
      return Response.json({ error: config.external_services_message || 'Modo demo activo: Stripe desactivado.' }, { status: 503 });
    }

    const publishableKey = getPublishableKey();
    if (!publishableKey) {
      return Response.json({ error: 'Stripe publishable key not set. Please configure STRIPE_PUBLISHABLE_KEY.' }, { status: 500 });
    }

    return Response.json({ publishableKey });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});