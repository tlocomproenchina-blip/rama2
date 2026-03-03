import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function replaceBrand(str) {
  if (typeof str !== 'string') return str;
  let out = str;
  // Replace any casing of "TLEC Logistics" to "TLEC CARGO"
  out = out.replace(/TLEC\s*Logistics/ig, 'TLEC CARGO');
  // Normalize any "TLEC Cargo" to uppercase brand too
  out = out.replace(/TLEC\s*Cargo/ig, 'TLEC CARGO');
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (me.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const results = { appConfigUpdated: 0, templatesScanned: 0, templatesUpdated: 0, changes: [] };

    // Update AppConfig (app name + invoice company name if needed)
    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    for (const cfg of cfgs) {
      const updated = { ...cfg };
      let changed = false;

      const nextAppName = 'TLEC CARGO';
      if (cfg.app_name !== nextAppName) { updated.app_name = nextAppName; changed = true; }

      const desiredCompany = 'TLEC CARGO LTD';
      if (cfg.invoice_company_name && cfg.invoice_company_name !== desiredCompany) {
        updated.invoice_company_name = desiredCompany; changed = true;
      }

      // Also scrub other string fields just in case
      const stringKeys = [
        'app_tagline','invoice_company_tagline','maintenance_message','binance_instructions','usdt_instructions',
        'paypal_instructions','debito_internacional_instructions','wally_instructions','zinli_instructions',
        'wise_instructions','skrill_instructions','pago_movil_usdt_instructions','contract_text'
      ];
      for (const k of stringKeys) {
        if (typeof updated[k] === 'string') {
          const rep = replaceBrand(updated[k]);
          if (rep !== updated[k]) { updated[k] = rep; changed = true; }
        }
      }

      if (changed) {
        await base44.asServiceRole.entities.AppConfig.update(cfg.id, updated);
        results.appConfigUpdated += 1;
      }
    }

    // Update Email Templates (name, subject, body)
    const templates = await base44.asServiceRole.entities.EmailTemplate.list();
    results.templatesScanned = templates.length;
    for (const t of templates) {
      let changed = false;
      const patch = {};

      if (typeof t.name === 'string') {
        const rep = replaceBrand(t.name);
        if (rep !== t.name) { patch.name = rep; changed = true; }
      }
      if (typeof t.subject === 'string') {
        const rep = replaceBrand(t.subject);
        if (rep !== t.subject) { patch.subject = rep; changed = true; }
      }
      if (typeof t.body === 'string') {
        const rep = replaceBrand(t.body);
        if (rep !== t.body) { patch.body = rep; changed = true; }
      }
      if (Array.isArray(t.attachments)) {
        const newAtt = t.attachments.map(att => ({
          ...att,
          name: replaceBrand(att?.name)
        }));
        if (JSON.stringify(newAtt) !== JSON.stringify(t.attachments)) { patch.attachments = newAtt; changed = true; }
      }

      if (changed) {
        await base44.asServiceRole.entities.EmailTemplate.update(t.id, patch);
        results.templatesUpdated += 1;
        results.changes.push({ id: t.id, name: patch.name || t.name });
      }
    }

    return Response.json({ ok: true, results });
  } catch (err) {
    return Response.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
});