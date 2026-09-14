import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const config = (configs && configs[0]) || {};

    const amount = Number(config.quote_fee_amount) || 20;
    const enabledMethods = Array.isArray(config.quote_fee_enabled_methods) && config.quote_fee_enabled_methods.length
      ? config.quote_fee_enabled_methods
      : ['stripe', 'paypal'];

    // Devolver datos de wallets/instrucciones para los métodos habilitados
    const methodDetails = {};
    const methodKeys = {
      binance: { wallet: 'wallet_binance', instructions: 'binance_instructions' },
      usdt_trc20: { wallet: 'wallet_usdt_trc20', instructions: 'usdt_instructions' },
      paypal: { wallet: 'wallet_paypal', instructions: 'paypal_instructions' },
      transferencia: { wallet: 'wallet_debito_internacional', instructions: 'debito_internacional_instructions' },
      wally: { wallet: 'wallet_wally', instructions: 'wally_instructions' },
      zinli: { wallet: 'wallet_zinli', instructions: 'zinli_instructions' },
      wise: { wallet: 'wallet_wise', instructions: 'wise_instructions' },
      skrill: { wallet: 'wallet_skrill', instructions: 'skrill_instructions' },
      pago_movil_usdt: { wallet: 'wallet_pago_movil_usdt', instructions: 'pago_movil_usdt_instructions' },
      zelle: { wallet: 'wallet_zelle', instructions: 'zelle_instructions' },
    };

    for (const m of enabledMethods) {
      const keys = methodKeys[m];
      if (keys) {
        methodDetails[m] = {
          wallet: config[keys.wallet] || '',
          instructions: config[keys.instructions] || '',
        };
      }
    }

    // Publishable key de Stripe si stripe está habilitado
    let stripePublishableKey = null;
    if (enabledMethods.includes('stripe')) {
      stripePublishableKey = Deno.env.get('stripepublicable') || null;
    }

    // Client ID de PayPal si paypal está habilitado
    let paypalClientId = null;
    if (enabledMethods.includes('paypal')) {
      paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID') || null;
    }

    return Response.json({
      amount,
      enabled_methods: enabledMethods,
      method_details: methodDetails,
      stripe_publishable_key: stripePublishableKey,
      paypal_client_id: paypalClientId,
      app_name: config.app_name || 'TLEC CARGO',
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}