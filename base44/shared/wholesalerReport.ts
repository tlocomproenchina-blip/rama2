// Informe cada 24 horas de los clientes nuevos que reporta el mayorista:
// se arma el Excel, se envía por correo a los administradores con la lista
// también en el cuerpo, y el detalle queda en el panel de la app.
import * as XLSX from 'npm:xlsx@0.18.5';
import { emailsEnabled, caracasDateKey, updateWholesalerConfig, logWholesalerEvent, truncate, formatCaracasDateTime } from './wholesalerCore.ts';

const MAX_ROWS = 200;

function statusLabel(status: string) {
  if (status === 'creado') return 'Cuenta creada';
  if (status === 'existente') return 'Ya existía';
  return 'Con error';
}

function buildReportHtml(clients: any[], cfg: any) {
  const name = cfg?.wholesaler_name || 'el cliente mayorista';
  const rows = clients.map((c) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${c.full_name || c.email}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${c.email}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${c.cedula || '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${c.whatsapp || '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;"><b>${c.shipping_mark || '—'}</b></td>
      <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${statusLabel(c.status)}</td>
    </tr>`).join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#1e293b;">
      <h2 style="margin:0 0 4px;">Clientes nuevos del mayorista</h2>
      <p style="margin:0 0 12px;color:#475569;">
        ${clients.length} cliente(s) nuevos reportados por ${name}. Detalle también en el Excel adjunto.
      </p>
      <table style="border-collapse:collapse;font-size:13px;width:100%;">
        <thead>
          <tr style="background:#f1f5f9;text-align:left;">
            <th style="padding:6px 8px;">Nombre</th>
            <th style="padding:6px 8px;">Correo</th>
            <th style="padding:6px 8px;">Cédula</th>
            <th style="padding:6px 8px;">WhatsApp</th>
            <th style="padding:6px 8px;">Ciudad / Estado</th>
            <th style="padding:6px 8px;">Shipping Mark</th>
            <th style="padding:6px 8px;">Cuenta</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:14px 0 0;color:#64748b;font-size:12px;">TLEC CARGO · informe automático de clientes del mayorista</p>
    </div>`;
}

function buildWorkbookBase64(clients: any[], today: string) {
  const rows = clients.map((c) => ({
    'Nombre': c.full_name || '',
    'Correo': c.email || '',
    'Cédula': c.cedula || '',
    'WhatsApp': c.whatsapp || '',
    'Ciudad': c.city || '',
    'Estado': c.state || '',
    'Shipping Mark': c.shipping_mark || '',
    'Cuenta': statusLabel(c.status),
    'Fecha de alta': formatCaracasDateTime(c.fetched_date),
    'Origen': 'Mayorista',
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, `Nuevos ${today}`);
  return XLSX.write(book, { type: 'base64', bookType: 'xlsx' });
}

export async function pendingReportClients(base44: any) {
  try {
    const rows = await base44.asServiceRole.entities.WholesalerClient.filter({ report_sent: false }, '-fetched_date', MAX_ROWS);
    return rows || [];
  } catch (_) {
    return [];
  }
}

export async function sendWholesalerReport(base44: any, cfg: any) {
  const clients = await pendingReportClients(base44);
  const today = caracasDateKey();
  const now = new Date().toISOString();

  if (!clients.length) {
    await updateWholesalerConfig(base44, {
      last_report_date: now,
      last_report_status: 'sin_clientes',
      last_report_clients_count: 0,
      last_report_message: 'No hubo clientes nuevos en este corte: no se envió correo.',
    });
    return { enviado: false, total: 0, enviados: 0, mensaje: 'No hubo clientes nuevos: no se envió correo.' };
  }

  const html = buildReportHtml(clients, cfg);
  const subject = `Clientes nuevos del mayorista · ${today}`;
  let enviados = 0;
  const errors: string[] = [];

  if (!(await emailsEnabled(base44))) {
    errors.push('El envío de correos está desactivado en la configuración general.');
  } else {
    const attachment = { filename: `clientes-mayorista-${today}.xlsx`, content: buildWorkbookBase64(clients, today) };
    let admins: any[] = [];
    try {
      admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', 100);
    } catch (_) {
      admins = [];
    }

    for (const admin of admins || []) {
      if (!admin?.email) continue;
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject,
          html,
          attachments: [attachment],
        });
        enviados += 1;
        try {
          await base44.asServiceRole.entities.EmailLog.create({
            recipient_email: admin.email,
            recipient_name: admin.full_name || null,
            subject,
            body_preview: truncate(html, 500),
            source: 'manual',
            status: 'sent',
            sent_date: new Date().toISOString(),
          });
        } catch (_) {}
      } catch (err: any) {
        errors.push(`${admin.email}: ${err?.message || 'envío fallido'}`);
      }
    }
    if (!admins?.length) errors.push('No se encontraron administradores activos.');
  }

  if (enviados > 0) {
    try {
      await base44.asServiceRole.entities.WholesalerClient.bulkUpdate(
        clients.map((c) => ({ id: c.id, report_sent: true, report_date: today }))
      );
    } catch (_) {}
    await updateWholesalerConfig(base44, {
      last_report_date: now,
      last_report_status: 'enviado',
      last_report_clients_count: clients.length,
      last_report_message: `Informe enviado a ${enviados} administrador(es) con ${clients.length} cliente(s).`,
    });
    await logWholesalerEvent(base44, {
      event_type: 'informe_enviado',
      result: 'enviado',
      detail: truncate(`${clients.length} cliente(s) · ${enviados} correo(s)`, 900),
    });
    return { enviado: true, total: clients.length, enviados, mensaje: `Informe enviado: ${clients.length} cliente(s) nuevo(s).` };
  }

  const detail = truncate(errors.join(' | ') || 'No se pudo enviar el informe.', 900);
  await updateWholesalerConfig(base44, {
    last_report_date: now,
    last_report_status: 'fallido',
    last_report_clients_count: clients.length,
    last_report_message: detail,
  });
  await logWholesalerEvent(base44, { event_type: 'informe_fallido', result: 'fallido', detail });
  return { enviado: false, total: clients.length, enviados: 0, mensaje: `El informe no se pudo enviar: ${detail}` };
}