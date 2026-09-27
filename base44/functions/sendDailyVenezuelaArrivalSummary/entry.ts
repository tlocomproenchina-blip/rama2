import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';
import { getClientNameByEmail } from '../../shared/clientName.ts';

// Aviso diario de carga reconocida en el almacén de Venezuela.
// Agrupa los bultos (y sus paquetes) reconocidos al escanear la carga que llega
// (/BultoOrderScan → assignBultoOrderNumbers) en las últimas 24 horas y envía
// UN email por cliente: su carga ya está en Venezuela y está próxima a la
// emisión de la factura. Este aviso reemplaza, para ese caso, el resumen diario
// de recepción del almacén de China (sendDailyReceivedSummary).
//
// El asunto y el texto son editables desde /AdminEmailTemplates en la plantilla
// "Carga en Venezuela - Aviso de llegada". Placeholders disponibles:
// {cliente_nombre}, {cantidad_bultos}, {cantidad_paquetes}, {detalle_bultos},
// {detalle_paquetes}, {detalle_carga}, {app_name}.

const TEMPLATE_NAME = 'Carga en Venezuela - Aviso de llegada';
const TEMPLATE_VARIABLES = [
  'cliente_nombre',
  'cantidad_bultos',
  'cantidad_paquetes',
  'detalle_bultos',
  'detalle_paquetes',
  'detalle_carga',
  'app_name',
];

const DEFAULT_SUBJECT = 'Tu carga ya está en Venezuela - {app_name}';
const DEFAULT_BODY =
  '<p>Hola <strong>{cliente_nombre}</strong>,</p>' +
  '<p>Te informamos que tu carga ya se encuentra en nuestro almacén de Venezuela y está ' +
  '<strong>próxima a la emisión de la factura</strong>.</p>' +
  '<p><strong>Detalle de lo reconocido:</strong></p>' +
  '<p>{detalle_carga}</p>' +
  '<p>Cuando la factura sea emitida la verás en tu portal de cliente.</p>' +
  '<p>Saludos,<br>Equipo {app_name}</p>';

const DAY_MS = 24 * 60 * 60 * 1000;

function formatBultoLine(b: any): string {
  const orders = Array.isArray(b.cbm_order_numbers) ? b.cbm_order_numbers.filter(Boolean) : [];
  const count = Array.isArray(b.package_ids) && b.package_ids.length
    ? b.package_ids.length
    : (Array.isArray(b.package_trackings) ? b.package_trackings.length : 0);
  const parts = [`• Bulto ${b.bulto_number || 1}/${b.total_bultos || b.bulto_number || 1} — ${b.label_code || ''}`];
  if (count) parts.push(`${count} paquete(s)`);
  if (orders.length) parts.push(`N° de orden: ${orders.join(', ')}`);
  return parts.join(' · ');
}

function formatPackageLine(p: any): string {
  const code = p.tracking_number || p.label_code || '(sin tracking)';
  return p.description ? `• ${code} — ${p.description}` : `• ${code}`;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    // Solo admin puede dispararlo a mano; el workflow programado invoca sin usuario.
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Kill switch global de emails
    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
    const cfg = cfgs?.[0] || {};
    if (cfg.emails_enabled === false) {
      return Response.json({ skipped: true, reason: 'emails_enabled is off' });
    }

    const since = new Date(Date.now() - DAY_MS).toISOString();

    // Bultos reconocidos en el almacén de Venezuela en las últimas 24h
    const recentBultos = await base44.asServiceRole.entities.Bulto.list('-ve_recognized_date', 300);
    const bultos = (recentBultos || []).filter(
      (b: any) => b.ve_recognized_date && b.ve_recognized_date >= since && !b.ve_notified_date && b.client_email
    );

    // Paquetes reconocidos en el almacén de Venezuela en las últimas 24h
    const recentPackages = await base44.asServiceRole.entities.Package.list('-ve_recognized_date', 500);
    const packages = (recentPackages || []).filter(
      (p: any) => p.ve_recognized_date && p.ve_recognized_date >= since && !p.ve_notified_date && p.client_email
    );

    if (!bultos.length && !packages.length) {
      return Response.json({ sent: 0, message: 'No hay carga reconocida en Venezuela en las últimas 24h' });
    }

    // Agrupar por cliente (un solo email por cliente y por día)
    const byClient = new Map<string, { bultos: any[]; packages: any[] }>();
    const groupOf = (email: string) => {
      if (!byClient.has(email)) byClient.set(email, { bultos: [], packages: [] });
      return byClient.get(email)!;
    };
    for (const b of bultos) groupOf(b.client_email).bultos.push(b);
    for (const p of packages) groupOf(p.client_email).packages.push(p);

    const appName = cfg.app_name || 'TLEC CARGO';

    // Plantilla editable por el admin: se crea con el texto por defecto la primera vez
    let template: any = { subject: DEFAULT_SUBJECT, body: DEFAULT_BODY };
    try {
      const found = await base44.asServiceRole.entities.EmailTemplate.filter({ name: TEMPLATE_NAME }, '-updated_date', 1);
      if (found?.[0]) {
        template = found[0];
      } else {
        template = await base44.asServiceRole.entities.EmailTemplate.create({
          name: TEMPLATE_NAME,
          description: 'Aviso al cliente cuando su carga es reconocida en el almacén de Venezuela (próxima a la emisión de la factura). Se envía una vez al día, agrupado por cliente.',
          category: 'paquetes',
          subject: DEFAULT_SUBJECT,
          body: DEFAULT_BODY,
          variables: TEMPLATE_VARIABLES,
        });
      }
    } catch (_) {
      // Si no se puede leer/crear la plantilla, se usa el texto por defecto
    }

    const sent = [];
    const errors = [];
    const notifiedBultoIds: string[] = [];
    const notifiedPackageIds: string[] = [];

    for (const [email, group] of byClient) {
      const clientName = await getClientNameByEmail(base44, email);
      const bultoLines = group.bultos.map(formatBultoLine).join('<br>');
      const packageLines = group.packages.map(formatPackageLine).join('<br>');
      const detalleCarga = [
        bultoLines ? `<strong>Bultos:</strong><br>${bultoLines}` : '',
        packageLines ? `<strong>Paquetes:</strong><br>${packageLines}` : '',
      ].filter(Boolean).join('<br><br>');

      const values: Record<string, string> = {
        cliente_nombre: clientName || email,
        cantidad_bultos: String(group.bultos.length),
        cantidad_paquetes: String(group.packages.length),
        detalle_bultos: bultoLines,
        detalle_paquetes: packageLines,
        detalle_carga: detalleCarga,
        app_name: appName,
      };
      const apply = (text: string) =>
        Object.keys(values).reduce(
          (acc, key) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), values[key]),
          String(text || '')
        );

      const subject = apply(template.subject || DEFAULT_SUBJECT);
      const body = apply(template.body || DEFAULT_BODY);

      const result = await sendBrevoEmail(base44, {
        to: email,
        subject,
        body,
        from_name: appName,
        source: 'campaign',
        campaign_name: 'Aviso de carga en Venezuela',
      });

      if (result.sent) {
        sent.push(email);
        group.bultos.forEach((b: any) => notifiedBultoIds.push(b.id));
        group.packages.forEach((p: any) => notifiedPackageIds.push(p.id));
      } else {
        errors.push({ email, error: result.error || 'No enviado' });
      }
    }

    // Marcar como avisado para no repetir el email en los días siguientes
    const notifiedAt = new Date().toISOString();
    if (notifiedBultoIds.length) {
      try {
        await base44.asServiceRole.entities.Bulto.bulkUpdate(
          notifiedBultoIds.map((id) => ({ id, ve_notified_date: notifiedAt }))
        );
      } catch (_) {
        for (const id of notifiedBultoIds) {
          try { await base44.asServiceRole.entities.Bulto.update(id, { ve_notified_date: notifiedAt }); } catch (_) {}
        }
      }
    }
    if (notifiedPackageIds.length) {
      try {
        await base44.asServiceRole.entities.Package.bulkUpdate(
          notifiedPackageIds.map((id) => ({ id, ve_notified_date: notifiedAt }))
        );
      } catch (_) {
        for (const id of notifiedPackageIds) {
          try { await base44.asServiceRole.entities.Package.update(id, { ve_notified_date: notifiedAt }); } catch (_) {}
        }
      }
    }

    return Response.json({
      sent: sent.length,
      clients: byClient.size,
      bultos: notifiedBultoIds.length,
      packages: notifiedPackageIds.length,
      errors,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}