// Cargos de almacenamiento y custodia de las facturas impagas (día 8 al 45).
//
// Se ejecuta a diario desde el workflow "Cargos de almacenamiento - Diario" y
// también a mano desde Gestión de Facturas (siempre en modo revisión primero).
//
//   mode: 'preview' → no escribe nada: devuelve qué se cobraría hoy.
//   mode: 'apply'   → registra los días nuevos, actualiza la factura y avisa al cliente.
//
// Es idempotente: solo cobra los días que todavía no tienen registro en
// StorageCharge, así que correrlo dos veces el mismo día no duplica nada.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';
import {
  loadStorageConfig,
  resolveStorageUnits,
  planInvoiceCharges,
  applyStorageLines,
  buildChargeRecords,
  chargeBreakdownText,
  storageDayNumber,
  storageDayKey,
  round2,
  text,
  num,
  STORAGE_CHARGES_ENABLED,
} from '../../shared/storageCharges.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const TEMPLATE_NAME = 'Almacenamiento - Cargo Diario';
const NOTICE_DAYS = [20, 30, 45];

function isUnpaidInvoice(invoice: any) {
  const status = text(invoice?.status);
  if (status === 'pagada' || status === 'cancelada') return false;
  return !!invoice?.invoice_date && !!text(invoice?.client_email);
}

async function candidateInvoices(base44: any, onlyIds: string[] | null, config: any) {
  if (onlyIds) {
    const page = await base44.asServiceRole.entities.Invoice
      .filter({ id: { $in: onlyIds } }, { limit: 200 });
    return (page?.items || []).filter(isUnpaidInvoice);
  }
  const since = new Date(Date.now() - (num(config.max_days) + 15) * DAY_MS).toISOString();
  const page = await base44.asServiceRole.entities.Invoice
    .filter({ invoice_date: { $gte: since } }, { sort: 'invoice_date', limit: 400 });
  const startDay = num(config.free_days) + 1;
  return (page?.items || [])
    .filter(isUnpaidInvoice)
    .filter((invoice: any) => storageDayNumber(invoice.invoice_date) >= startDay);
}

async function clientNames(base44: any, emails: string[]) {
  const map: Record<string, string> = {};
  const batches: string[][] = [];
  for (let i = 0; i < emails.length; i += 20) batches.push(emails.slice(i, i + 20));
  const pages = await Promise.all(batches.map((batch) => base44.asServiceRole.entities.User
    .filter({ email: { $in: batch } }, { limit: 50 })
    .catch(() => [])));
  for (const page of pages) {
    for (const user of (Array.isArray(page) ? page : page?.items || [])) {
      const name = text(user.full_name) || `${text(user.first_name)} ${text(user.last_name)}`.trim();
      if (name) map[user.email] = name;
    }
  }
  return map;
}

async function notifyClient(base44: any, { invoice, plan, clientName, emailEnabled, template, config }: any) {
  const invoiceNumber = text(invoice.invoice_number) || invoice.id;
  const dayLabel = plan.days.length ? `día ${plan.days[0]} al ${plan.days[plan.days.length - 1]}` : `día ${plan.day_number}`;

  const titles = {
    title: `📦 Cargo de almacenamiento - factura ${invoiceNumber}`,
    message:
      `Se agregaron $${round2(plan.amount).toFixed(2)} a tu factura ${invoiceNumber} (${dayLabel}). ` +
      `Almacenamiento y custodia acumulado: $${round2(plan.accumulated_after).toFixed(2)}. ` +
      `Puedes pagar y coordinar el retiro de tu mercancía desde Mis Facturas.`,
  };

  try {
    await base44.asServiceRole.entities.Notification.create({
      user_email: plan.client_email,
      title: titles.title,
      message: titles.message,
      type: 'payment',
      priority: plan.day_number >= 30 ? 'high' : 'medium',
      icon: 'alert',
      reference_id: invoice.id,
      entity_type: 'Invoice',
      read: false,
    });
  } catch (_) {
    // La notificación in-app es informativa: si falla, el cargo ya quedó registrado.
  }

  const skipEmail = config.skip_threshold_days !== false && NOTICE_DAYS.includes(num(plan.day_number));
  if (!config.notify_client || !emailEnabled || skipEmail || !template) {
    return { sent: false, reason: skipEmail ? 'día de aviso formal' : (!template ? 'sin plantilla' : 'avisos apagados') };
  }

  const clientFirstName = text(clientName).split(' ')[0] || 'cliente';
  const replacements: Record<string, string> = {
    '{cliente_nombre}': clientName || 'cliente',
    '{cliente_primer_nombre}': clientFirstName,
    '{numero_factura}': invoiceNumber,
    '{fecha_factura}': text(invoice.invoice_date).slice(0, 10),
    '{dia_actual}': String(plan.day_number),
    '{dias_cobrados}': String(plan.days.length || 0),
    '{desglose}': chargeBreakdownText(plan).replace(/\n/g, '<br>'),
    '{acumulado}': round2(plan.accumulated_after).toFixed(2),
    '{total_agregado}': round2(plan.amount).toFixed(2),
    '{total_factura}': round2(plan.total_after).toFixed(2),
    '{enlace_facturas}': 'https://tleccargo.com/MyInvoices',
  };
  const fill = (value: string) => Object.entries(replacements)
    .reduce((acc, [key, replacement]) => acc.split(key).join(replacement), text(value));

  const res = await sendBrevoEmail(base44, {
    to: plan.client_email,
    subject: fill(template.subject || `Cargo de almacenamiento - factura ${invoiceNumber}`),
    body: fill(template.body || ''),
    from_name: 'TLEC CARGO',
    source: 'almacenamiento',
  });
  return { sent: !!res?.sent, via: res?.via, error: res?.error };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const payload: any = await req.json().catch(() => ({}));
    const mode = payload?.mode === 'apply' ? 'apply' : 'preview';
    const onlyIds = Array.isArray(payload?.invoice_ids) && payload.invoice_ids.length ? payload.invoice_ids : null;

    const config = await loadStorageConfig(base44);
    if (!STORAGE_CHARGES_ENABLED) {
      return Response.json({ success: true, mode, skipped: 'cargos_desactivados', config, results: [] });
    }
    if (!config.is_active) {
      return Response.json({ success: true, mode, skipped: 'config_inactiva', config, results: [] });
    }

    const appCfg = (await base44.asServiceRole.entities.AppConfig
      .filter({ config_key: 'main' }, { limit: 1 })
      .catch(() => ({ items: [] })))?.items?.[0] || null;
    const emailEnabled = appCfg?.emails_enabled !== false && !appCfg?.demo_mode;

    const invoices = await candidateInvoices(base44, onlyIds, config);
    const names = emailEnabled
      ? await clientNames(base44, [...new Set(invoices.map((i: any) => text(i.client_email)).filter(Boolean))])
      : {};
    const templates = await base44.asServiceRole.entities.EmailTemplate
      .filter({ name: TEMPLATE_NAME }, { limit: 1 })
      .catch(() => ({ items: [] }));
    const template = (templates?.items || [])[0] || null;

    const results: any[] = [];
    const chargeDate = storageDayKey();
    let applied = 0;
    let emailsSent = 0;

    for (const invoice of invoices) {
      const unitsInfo = await resolveStorageUnits(base44, invoice, config);
      const chargePage = await base44.asServiceRole.entities.StorageCharge
        .filter({ invoice_id: invoice.id }, { sort: '-day_number', limit: 300 })
        .catch(() => ({ items: [] }));
      const charges = chargePage?.items || [];
      const plan = planInvoiceCharges({ invoice, units: unitsInfo.units, charges, config });

      const row: any = {
        invoice_id: invoice.id,
        invoice_number: text(invoice.invoice_number),
        client_email: text(invoice.client_email),
        status: text(invoice.status),
        invoice_date: invoice.invoice_date,
        day_number: plan.day_number,
        days: plan.days,
        days_count: plan.days.length,
        units_standard: plan.units_standard,
        units_large: plan.units_large,
        units_total: plan.units_total,
        units_source: unitsInfo.source,
        units: unitsInfo.units,
        daily_amount: plan.daily_amount,
        storage_amount: plan.storage_amount,
        forklift_pallets: plan.forklift_pallets,
        forklift_pallets_marked: plan.forklift_pallets_marked,
        forklift_amount: plan.forklift_amount,
        amount: plan.amount,
        accumulated_after: plan.accumulated_after,
        total_before: plan.total_before,
        total_after: plan.total_after,
        changed: plan.changed,
        stopped: plan.stopped,
        already_charged_days: charges.filter((c: any) => num(c.days_count) > 0).length,
        reason: unitsInfo.reason,
      };

      if (mode === 'preview') {
        results.push(row);
        continue;
      }

      // Nada nuevo que registrar: ni días por cobrar ni el aviso de fin de contrato.
      if (!plan.changed && (!plan.stopped || plan.stop_notice_created)) {
        row.skipped = 'sin_cargos_nuevos';
        results.push(row);
        continue;
      }

      const records = buildChargeRecords(plan, unitsInfo.units, {
        createdBy: user.email || 'sistema (automático)',
        chargeDate,
        unitsSource: unitsInfo.source,
      });

      if (records.length) {
        await base44.asServiceRole.entities.StorageCharge.bulkCreate(records);
      }

      if (plan.changed) {
        const lines = applyStorageLines(invoice, plan, unitsInfo.units);
        await base44.asServiceRole.entities.Invoice.update(invoice.id, {
          items: lines.items,
          subtotal: lines.subtotal,
          total: lines.total,
        });
        row.invoice_total_after = lines.total;
        row.applied_amount = lines.delta;
        applied += 1;

        const notice = await notifyClient(base44, {
          invoice,
          plan,
          clientName: names[text(invoice.client_email)] || text(invoice.client_email).split('@')[0],
          emailEnabled,
          template,
          config,
        });
        row.email = notice;
        if (notice?.sent) emailsSent += 1;
        if (records.length) {
          await base44.asServiceRole.entities.StorageCharge.updateMany(
            { invoice_id: invoice.id, charge_date: chargeDate },
            { $set: { notified: true, notified_date: new Date().toISOString() } }
          ).catch(() => null);
        }
      }

      results.push(row);
    }

    return Response.json({
      success: true,
      mode,
      charge_date: chargeDate,
      config,
      totals: {
        invoices: results.length,
        with_system_change: results.filter((r) => r.changed).length,
        applied,
        pending_amount: round2(results.reduce((sum, r) => sum + num(r.amount), 0)),
        emails_sent: emailsSent,
      },
      results,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}