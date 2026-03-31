import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Verify admin
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get app config
    const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const config = configs.length > 0 ? configs[0] : null;
    const appName = config?.app_name || 'TLEC CARGO';

    // Get all email templates
    const templates = await base44.asServiceRole.entities.EmailTemplate.list();

    const updatedTemplates = [];

    // Update each template
    for (const template of templates) {
      let updated = false;
      const updates = {};

      // Normalize branding to current app name (replace 'TLEC Logistics' and 'LTD')
      const subjectOrig = template.subject || '';
      const bodyOrig = template.body || '';
      let subjectNew = subjectOrig;
      let bodyNew = bodyOrig;

      const patterns = [/TLEC Logistics/gi, /\bLTD\b/gi];

      for (const p of patterns) {
        subjectNew = subjectNew.replace(p, appName);
        bodyNew = bodyNew.replace(p, appName);
      }

      if (subjectNew !== subjectOrig) {
        updates.subject = subjectNew;
        updated = true;
      }
      if (bodyNew !== bodyOrig) {
        updates.body = bodyNew;
        updated = true;
      }

      if (updated) {
        await base44.asServiceRole.entities.EmailTemplate.update(template.id, updates);
        updatedTemplates.push({
          id: template.id,
          name: template.name,
          changes: Object.keys(updates)
        });
      }
    }

    return Response.json({
      success: true,
      message: `${updatedTemplates.length} plantillas actualizadas`,
      appName,
      updatedTemplates
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});