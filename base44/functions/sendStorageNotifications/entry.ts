import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

const TEMPLATE_NAMES = {
  '20': 'Almacenamiento - Aviso Completo (20 días)',
  '30': 'Almacenamiento - 30 Días Vencido',
  '45': 'Almacenamiento - Inicio de Remate (45 días)'
};

const THRESHOLDS = [
  { days: 20, field: 'storage_notif_20_sent', key: '20' },
  { days: 30, field: 'storage_notif_30_sent', key: '30' },
  { days: 45, field: 'storage_notif_45_sent', key: '45' }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Solo admin puede disparar manualmente; las automatizaciones programadas
    // invocan sin usuario, por lo que también permitimos service-role puro.
    const isAutomation = req.headers.get('x-base44-automation') === 'true';
    if (!isAutomation && (!user || user.role !== 'admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 1. Cargar las 3 plantillas por nombre
    const allTemplates = await base44.asServiceRole.entities.EmailTemplate.filter({});
    const templates = {};
    for (const key of ['20', '30', '45']) {
      templates[key] = allTemplates.find(t => t.name === TEMPLATE_NAMES[key]);
    }
    const missing = Object.entries(templates).filter(([, t]) => !t).map(([k]) => k);
    if (missing.length) {
      return Response.json({
        error: `Faltan plantillas de almacenamiento: ${missing.join(', ')}`
      }, { status: 500 });
    }

    // 2. Obtener todas las facturas (paginado)
    const allInvoices = [];
    let skip = 0;
    const pageSize = 100;
    while (true) {
      const batch = await base44.asServiceRole.entities.Invoice.list('-invoice_date', pageSize, skip);
      allInvoices.push(...batch);
      if (batch.length < pageSize) break;
      skip += pageSize;
    }

    const now = new Date();

    // 3. Identificar facturas que necesitan notificación
    const pending = [];
    for (const inv of allInvoices) {
      // Saltar facturas pagadas o canceladas
      if (inv.status === 'pagada' || inv.status === 'cancelada') continue;
      if (!inv.invoice_date || !inv.client_email) continue;

      const daysSince = Math.floor((now.getTime() - new Date(inv.invoice_date).getTime()) / DAY_MS);
      const needed = [];
      for (const t of THRESHOLDS) {
        if (daysSince >= t.days && !inv[t.field]) {
          needed.push(t);
        }
      }
      if (needed.length > 0) {
        pending.push({ inv, daysSince, needed });
      }
    }

    if (pending.length === 0) {
      return Response.json({ success: true, processed: 0, message: 'No hay facturas pendientes de notificación' });
    }

    // 4. Obtener nombres de clientes (solo los que necesitamos)
    const clientEmails = [...new Set(pending.map(p => p.inv.client_email))];
    const clientsMap = {};
    for (const email of clientEmails) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email });
        if (users[0]) {
          const u = users[0];
          clientsMap[email] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'cliente';
        }
      } catch (_) {
        clientsMap[email] = 'cliente';
      }
    }

    // 5. Enviar emails y marcar como enviados
    const results = [];
    for (const { inv, daysSince, needed } of pending) {
      const clientName = clientsMap[inv.client_email] || 'cliente';

      for (const t of needed) {
        const tpl = templates[t.key];
        const subject = (tpl.subject || '').replace(/\{cliente_nombre\}/g, clientName);
        const body = (tpl.body || '').replace(/\{cliente_nombre\}/g, clientName);

        const res = await sendBrevoEmail(base44, {
          to: inv.client_email,
          subject,
          body,
          from_name: 'TLEC CARGO'
        });

        if (res.sent) {
          await base44.asServiceRole.entities.Invoice.update(inv.id, { [t.field]: true });
          results.push({
            invoice: inv.invoice_number,
            client: inv.client_email,
            days: daysSince,
            type: `${t.days}d`,
            via: res.via
          });
        } else {
          results.push({
            invoice: inv.invoice_number,
            client: inv.client_email,
            days: daysSince,
            type: `${t.days}d`,
            error: res.error || 'No enviado'
          });
        }
      }
    }

    return Response.json({
      success: true,
      processed: results.length,
      details: results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});