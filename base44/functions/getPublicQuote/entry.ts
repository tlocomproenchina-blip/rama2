import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const token = String(body.token || '').trim();
    if (!token) return Response.json({ error: 'Token requerido' }, { status: 400 });

    const quotes = await base44.asServiceRole.entities.Quote.filter({ token }, '-created_date', 1);
    if (!quotes.length) return Response.json({ error: 'Presupuesto no encontrado' }, { status: 404 });

    const quote = quotes[0];
    // Contrato: usar el contrato específico del presupuesto si existe, si no el global
    let contractText = quote.contract_text || '';
    let contractFileUrl = quote.contract_file_url || '';
    let globalRate = quote.conversion_rate || 0.15;
    if (!contractText || !contractFileUrl) {
      try {
        const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
        if (configs.length) {
          if (!contractText) contractText = configs[0].contract_text || '';
          if (!contractFileUrl) contractFileUrl = configs[0].contract_file_url || '';
          if (!quote.conversion_rate) globalRate = configs[0].quote_conversion_rate || 0.15;
        }
      } catch {}
    }

    return Response.json({ quote, contract_text: contractText, contract_file_url: contractFileUrl, global_conversion_rate: globalRate });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}