import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

// Campaña de recordatorio del comprobante de entrega.
// Reúne a los clientes con cargas pre-alertadas de los últimos 30 días, arma el
// correo con las imágenes de referencia y, tras la confirmación del admin, lo
// envía a cada uno dejando el resultado registrado cliente por cliente.

const APP_URL = 'https://tleccargo.com';
const MY_PACKAGES_URL = `${APP_URL}/MyPackages`;
const BRAND_NAME = 'TLEC CARGO by TELOCOMPROENCHINA';
const TAGLINE = 'Tu carga asegurada desde China hasta Venezuela';
const LOGO_URL = 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/362c2e6ac_WhatsAppImage2026-08-17at90120AM.jpeg';
const CAMPAIGN_NAME = 'Comprobantes de entrega';
const CONFIG_KEY = 'main';
const WINDOW_DAYS = 30;
const MAX_RECIPIENTS = 500;
const SEND_DELAY_MS = 120;

const DEFAULT_SUBJECT = 'Nos falta el comprobante de entrega de tu carga (48 horas)';
const DEFAULT_INTRO = 'Recibimos tu pre-alerta, pero todavía nos falta la evidencia de que el vendedor entregó la carga en nuestro almacén de China: la fecha de entrega y la foto del comprobante. Ese respaldo es indispensable para mantener la cobertura del seguro de tu carga.';
const DEFAULT_IMAGES = [
  {
    url: 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/2484aa300_WhatsAppImage2026-04-03at12951PM.jpg',
    caption: 'Ejemplo del comprobante en Pinduoduo'
  },
  {
    url: 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/d11b83368_WhatsAppImage2026-04-03at12833PM.jpg',
    caption: 'Ejemplo del comprobante en 1688'
  },
  { url: '', caption: 'Cómo se ve tu carga en Mis Paquetes' },
  { url: '', caption: 'Dónde agregas la fecha y la foto del comprobante' }
];

function isEmail(value: any) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

function escapeHtml(value: any) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Fecha límite en hora de Caracas: se calcula desde el momento del correo,
// no como una fecha fija para todos.
function caracasDeadline(hours: number) {
  const target = new Date(Date.now() + Number(hours || 48) * 3600 * 1000);
  const formatted = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(target);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// Guarda las posiciones (incluidas las vacías) para que el panel muestre los
// cuatro espacios de imagen aunque todavía no todos tengan enlace.
function sanitizeImages(images: any) {
  const list = Array.isArray(images) ? images : [];
  return list.slice(0, 6).map((item: any) => ({
    url: String(item?.url || '').trim(),
    caption: String(item?.caption || '').trim().slice(0, 200)
  }));
}

function usableImages(images: any) {
  return sanitizeImages(images).filter((img: any) => /^https?:\/\/.+/i.test(img.url));
}

function stepRow(number: number, text: string) {
  return `<tr>
    <td width="30" valign="top" style="width:30px;padding:0 8px 12px 0;">
      <div style="width:22px;height:22px;border-radius:999px;background-color:#5c9eeb;color:#000000;font-size:12px;font-weight:700;text-align:center;line-height:22px;font-family:Inter,Arial,sans-serif;">${number}</div>
    </td>
    <td valign="top" style="padding:0 0 12px;line-height:1.55;">${text}</td>
  </tr>`;
}

function buildEmail({ intro, hours, images, recipient }: { intro: string; hours: number; images: any[]; recipient: any }) {
  const name = String(recipient?.client_name || recipient?.name || '').trim() || 'cliente';
  const email = String(recipient?.email || '').trim();
  const trackings: string[] = Array.isArray(recipient?.trackings) ? recipient.trackings.map((t: any) => String(t)) : [];
  const total = Number(recipient?.count || trackings.length || 0);
  const shown = trackings.slice(0, 5);
  const extra = Math.max(0, total - shown.length);
  const chips = shown
    .map((t) => `<span style="display:inline-block;background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:3px 8px;margin:3px 6px 3px 0;font-family:Courier New,monospace;font-size:12px;color:#1e3a8a;">${escapeHtml(t)}</span>`)
    .join('');
  const deadline = caracasDeadline(hours);

  const imagesHtml = images
    .map((img: any) => `<tr><td style="padding:0 0 16px;">
      <img src="${img.url}" alt="${escapeHtml(img.caption || 'Ejemplo')}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:1px solid #e5e7eb;border-radius:12px;" />
      ${img.caption ? `<div style="font-family:Manrope,Arial,sans-serif;font-size:13px;color:#64748b;padding-top:6px;">${escapeHtml(img.caption)}</div>` : ''}
    </td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Comprobante de entrega pendiente</title>
</head>
<body style="margin:0;padding:0;background-color:#f7fafd;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7fafd;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">

          <tr>
            <td style="background-color:#5c9eeb;padding:20px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="64" valign="middle" style="width:64px;">
                    <img src="${LOGO_URL}" alt="TLEC CARGO" width="52" height="52" style="display:block;width:52px;height:52px;border-radius:12px;background-color:#ffffff;" />
                  </td>
                  <td valign="middle" style="padding-left:14px;font-family:Inter,Arial,sans-serif;">
                    <div style="font-size:17px;font-weight:700;color:#000000;">${BRAND_NAME}</div>
                    <div style="font-size:12px;color:#0f172a;">${TAGLINE}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 24px 0;font-family:Inter,Arial,sans-serif;">
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#0f172a;">Hola ${escapeHtml(name)}, falta el comprobante de entrega de tu carga</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px 0;font-family:Manrope,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;">
              <p style="margin:0;">${escapeHtml(intro)}</p>
            </td>
          </tr>

          ${total > 0 ? `<tr>
            <td style="padding:16px 24px 0;font-family:Manrope,Arial,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7fafd;border:1px solid #e5e7eb;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <div style="font-size:13px;font-weight:700;color:#0f172a;">Cargas pre-alertadas sin comprobante: ${total}</div>
                    ${total > 1 ? `<div style="font-size:12px;color:#64748b;padding-top:8px;">${chips}${extra ? `<span style="font-size:12px;color:#64748b;">y ${extra} más</span>` : ''}</div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <tr>
            <td style="padding:14px 24px 0;font-family:Manrope,Arial,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;font-size:14px;line-height:1.55;color:#7c2d12;">
                    <strong>Tienes ${Number(hours || 48)} horas</strong> desde que recibes este correo para cargarla: hasta el <strong>${deadline}</strong> (hora de Caracas). Pasado el plazo, tu carga queda sin el respaldo que exige el seguro.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 24px 0;font-family:Inter,Arial,sans-serif;">
              <div style="font-size:15px;font-weight:700;color:#0f172a;padding-bottom:10px;">Cómo cargar el comprobante en 3 pasos</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:Manrope,Arial,sans-serif;font-size:14px;color:#0f172a;">
                ${stepRow(1, 'Entra a tu cuenta de TLEC CARGO y abre <strong>Mis Paquetes</strong>.')}
                ${stepRow(2, 'Busca la carga con la pre-alerta y pulsa <strong>Agregar fecha entrega</strong>.')}
                ${stepRow(3, 'Registra la <strong>fecha en que el vendedor entregó el paquete</strong> en el almacén y sube la <strong>foto del comprobante</strong> (guía o recibo de entrega).')}
              </table>
            </td>
          </tr>

          ${imagesHtml ? `<tr>
            <td style="padding:18px 24px 0;font-family:Inter,Arial,sans-serif;">
              <div style="font-size:15px;font-weight:700;color:#0f172a;padding-bottom:10px;">Ejemplos y guía rápida</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${imagesHtml}</table>
            </td>
          </tr>` : ''}

          <tr>
            <td align="center" style="padding:8px 24px 22px;font-family:Inter,Arial,sans-serif;">
              <a href="${MY_PACKAGES_URL}" style="display:inline-block;background-color:#5c9eeb;color:#000000;text-decoration:none;font-size:15px;font-weight:700;padding:14px 28px;border-radius:12px;">Cargar fecha y foto en Mis Paquetes</a>
            </td>
          </tr>

          <tr>
            <td style="padding:0 24px 24px;font-family:Manrope,Arial,sans-serif;font-size:13px;line-height:1.6;color:#64748b;">
              Si ya cargaste la fecha y la foto, puedes ignorar este correo.
            </td>
          </tr>

          <tr>
            <td style="background-color:#f7fafd;border-top:1px solid #e5e7eb;padding:18px 24px;font-family:Manrope,Arial,sans-serif;font-size:12px;line-height:1.6;color:#64748b;">
              ${BRAND_NAME} · ${TAGLINE}<br />
              <a href="${APP_URL}" style="color:#5c9eeb;text-decoration:none;">tleccargo.com</a>${email ? ` · Este correo llegó a ${escapeHtml(email)} porque tienes una carga pre-alertada en nuestro almacén de China.` : ''}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function loadConfig(base44: any) {
  const found = await base44.asServiceRole.entities.DeliveryProofCampaign.filter({ config_key: CONFIG_KEY }, '-updated_date', 1);
  if (found?.[0]) return found[0];
  return await base44.asServiceRole.entities.DeliveryProofCampaign.create({
    config_key: CONFIG_KEY,
    subject: DEFAULT_SUBJECT,
    intro_text: DEFAULT_INTRO,
    images: DEFAULT_IMAGES,
    deadline_hours: 48,
    last_run_status: 'nunca'
  });
}

// Clientes con cargas pre-alertadas creadas en los últimos 30 días: se deduplica
// por correo y se descartan los registros sin correo válido.
async function collectRecipients(base44: any) {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
  const map = new Map<string, any>();
  let skip = 0;
  const PAGE = 200;

  for (let page = 0; page < 40; page++) {
    const batch = await base44.asServiceRole.entities.Package.filter(
      { status: 'pre_alerta', created_date: { $gte: since } },
      '-created_date',
      PAGE,
      skip
    );
    if (!batch || batch.length === 0) break;
    for (const pkg of batch) {
      const email = String(pkg.client_email || '').trim().toLowerCase();
      if (!isEmail(email)) continue;
      const entry = map.get(email) || { email, trackings: [], shipping_mark: '', created_date: pkg.created_date || '' };
      if (pkg.tracking_number) entry.trackings.push(String(pkg.tracking_number));
      if (!entry.shipping_mark && pkg.shipping_mark) entry.shipping_mark = String(pkg.shipping_mark);
      map.set(email, entry);
    }
    if (batch.length < PAGE) break;
    skip += PAGE;
  }

  const recipients = [...map.values()].map((entry) => ({
    email: entry.email,
    trackings: entry.trackings,
    count: entry.trackings.length,
    shipping_mark: entry.shipping_mark,
    client_name: entry.shipping_mark || 'cliente'
  }));

  // Nombre del cliente para el saludo del correo.
  const names = new Map<string, string>();
  const emails = recipients.map((r) => r.email);
  for (let i = 0; i < emails.length; i += 50) {
    const chunk = emails.slice(i, i + 50);
    try {
      const users = await base44.asServiceRole.entities.User.filter({ email: { $in: chunk } });
      for (const user of users || []) {
        const key = String(user.email || '').trim().toLowerCase();
        if (key && user.full_name) names.set(key, String(user.full_name));
      }
    } catch (_) {
      // Si no se puede leer el directorio, el correo sale con el shipping mark.
    }
  }

  return recipients.map((r) => ({ ...r, client_name: names.get(r.email) || r.client_name }));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me || me.role !== 'admin') {
      return Response.json({ error: 'Solo administradores pueden usar esta campaña.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'preview');
    const saved = await loadConfig(base44);

    const draft = {
      subject: String(body.subject ?? saved.subject ?? DEFAULT_SUBJECT).trim().slice(0, 200) || DEFAULT_SUBJECT,
      intro_text: String(body.intro_text ?? saved.intro_text ?? DEFAULT_INTRO).trim().slice(0, 1000),
      images: body.images ? sanitizeImages(body.images) : sanitizeImages(saved.images?.length ? saved.images : DEFAULT_IMAGES),
      deadline_hours: Number(body.deadline_hours ?? saved.deadline_hours ?? 48) || 48
    };

    if (action === 'save') {
      await base44.asServiceRole.entities.DeliveryProofCampaign.update(saved.id, {
        subject: draft.subject,
        intro_text: draft.intro_text,
        images: draft.images,
        deadline_hours: draft.deadline_hours
      });
      return Response.json({ ok: true, config: draft });
    }

    const eligible = await collectRecipients(base44);
    const notified = new Set(
      (saved.results || [])
        .filter((row: any) => row?.status === 'enviado')
        .map((row: any) => String(row.email || '').trim().toLowerCase())
    );
    const excludeNotified = body.exclude_notified === true;
    const targets = excludeNotified ? eligible.filter((r) => !notified.has(r.email)) : eligible;
    const packages = targets.reduce((sum, r) => sum + Number(r.count || 0), 0);

    const totals = {
      eligible: eligible.length,
      notified: eligible.filter((r) => notified.has(r.email)).length,
      targets: targets.length,
      packages,
      excluded: excludeNotified ? Math.max(0, eligible.length - targets.length) : 0
    };

    if (action === 'preview') {
      const sample = targets[0] || {
        email: 'cliente@ejemplo.com',
        client_name: 'Cliente de ejemplo',
        trackings: ['TLEC000000'],
        count: 1,
        shipping_mark: 'TLEC000000'
      };
      return Response.json({
        ok: true,
        html: buildEmail({
          intro: draft.intro_text,
          hours: draft.deadline_hours,
          images: usableImages(draft.images),
          recipient: sample
        }),
        totals,
        sample: targets.slice(0, 60).map((r) => ({ email: r.email, client_name: r.client_name, count: r.count })),
        config: {
          subject: draft.subject,
          intro_text: draft.intro_text,
          images: draft.images,
          deadline_hours: draft.deadline_hours,
          last_run_date: saved.last_run_date || null,
          last_run_by: saved.last_run_by || null,
          last_run_status: saved.last_run_status || 'nunca',
          last_run_recipients: saved.last_run_recipients || 0,
          last_run_sent: saved.last_run_sent || 0,
          last_run_failed: saved.last_run_failed || 0,
          last_run_message: saved.last_run_message || '',
          results: saved.results || []
        }
      });
    }

    if (action === 'send') {
      if (body.confirm !== true) {
        return Response.json({ error: 'Falta la confirmación del envío.' }, { status: 400 });
      }
      if (targets.length === 0) {
        return Response.json({ error: 'No hay clientes elegibles para enviar.' }, { status: 400 });
      }

      const queue = targets.slice(0, MAX_RECIPIENTS);
      const results: any[] = [];
      let sent = 0;
      let failed = 0;

      for (const recipient of queue) {
        const html = buildEmail({
          intro: draft.intro_text,
          hours: draft.deadline_hours,
          images: usableImages(draft.images),
          recipient
        });
        const outcome = await sendBrevoEmail(base44, {
          to: recipient.email,
          subject: draft.subject,
          body: html,
          from_name: 'TLEC CARGO',
          source: 'campaign',
          campaign_name: CAMPAIGN_NAME
        });
        results.push({
          email: recipient.email,
          client_name: recipient.client_name,
          trackings_count: recipient.count,
          status: outcome.sent ? 'enviado' : 'fallido',
          error: outcome.sent ? '' : String(outcome.error || 'No se pudo enviar').slice(0, 300),
          date: new Date().toISOString()
        });
        if (outcome.sent) sent++;
        else failed++;
        if (SEND_DELAY_MS) await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
      }

      const status = failed === 0 ? 'enviada' : sent === 0 ? 'fallida' : 'parcial';
      const message = `${sent} de ${queue.length} correos entregados${failed ? `, ${failed} fallidos.` : '.'}`;

      await base44.asServiceRole.entities.DeliveryProofCampaign.update(saved.id, {
        subject: draft.subject,
        intro_text: draft.intro_text,
        images: draft.images,
        deadline_hours: draft.deadline_hours,
        last_run_date: new Date().toISOString(),
        last_run_by: me.email || '',
        last_run_status: status,
        last_run_recipients: queue.length,
        last_run_sent: sent,
        last_run_failed: failed,
        last_run_message: message,
        results
      });

      return Response.json({
        ok: true,
        status,
        sent,
        failed,
        total: queue.length,
        message,
        totals,
        results
      });
    }

    return Response.json({ error: `Acción no reconocida: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as any)?.message || 'No se pudo completar la campaña.' }, { status: 500 });
  }
});