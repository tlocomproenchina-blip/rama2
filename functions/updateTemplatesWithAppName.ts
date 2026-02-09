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
    const appName = config?.app_name || 'TLEC Logistics';

    // Get all email templates
    const templates = await base44.asServiceRole.entities.EmailTemplate.list();

    const updatedTemplates = [];

    // Update each template
    for (const template of templates) {
      let updated = false;
      const updates = {};

      // Replace hardcoded "TLEC Logistics" with dynamic app name
      if (template.subject && template.subject.includes('TLEC Logistics')) {
        updates.subject = template.subject.replace(/TLEC Logistics/g, appName);
        updated = true;
      }

      if (template.body && template.body.includes('TLEC Logistics')) {
        updates.body = template.body.replace(/TLEC Logistics/g, appName);
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