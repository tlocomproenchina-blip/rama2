import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

// Campaña del comprobante de entrega.
// Reúne a todos los clientes con Shipping Mark asignado, arma el correo con las
// cuatro imágenes de referencia y, tras la confirmación del admin, lo envía a
// cada uno dejando el resultado registrado cliente por cliente.

const APP_URL = 'https://tleccargo.com';
const MY_PACKAGES_URL = `${APP_URL}/MyPackages`;
const BRAND_NAME = 'TLEC CARGO by TELOCOMPROENCHINA';
const TAGLINE = 'Tu carga asegurada desde China hasta Venezuela';
const LOGO_URL = 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/362c2e6ac_WhatsAppImage2026-08-17at90120AM.jpeg';
const CAMPAIGN_NAME = 'Comprobantes de entrega';
const CONFIG_KEY = 'main';
// Cada corrida envía un lote: el correo a cada cliente toma tiempo y la corrida
// debe alcanzar a completarse para que quede registrado quién lo recibió. Con una
// sola confirmación del admin el panel pide lote tras lote hasta cubrir a todos
// los pendientes, sin repetir a los que ya recibieron el correo.
const MAX_RECIPIENTS = 120;
const SEND_DELAY_MS = 120;

const DEFAULT_SUBJECT = 'Carga la fecha y la foto del comprobante de entrega: ahora es obligatorio';
const DEFAULT_INTRO = 'Queremos informarte de un cambio importante. A partir de la recepción de este correo, cargar la fecha en que el vendedor entregó tu paquete en nuestro almacén de China y la foto del comprobante de entrega es obligatorio para todos los clientes con Shipping Mark asignado. Ese respaldo es lo que permite validar el seguro de tu carga si alguna vez necesitas reclamarlo.';
const DEFAULT_IMAGES = [
  {
    url: 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/e234e21ac_image.png',
    caption: 'Ejemplo en Pinduoduo: la entrega del vendedor aparece como recibida con su fecha y hora.'
  },
  {
    url: 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/c534edb13_image.png',
    caption: 'Ejemplo en 1688: la guía del vendedor muestra la entrega con su fecha exacta.'
  },
  {
    url: 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/b2ab15b8a_Untitleddesign.png',
    caption: 'En Mis Paquetes, pulsa Agregar fecha entrega en la carga que quieras respaldar.'
  },
  {
    url: 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/f0674fd71_Capturadepantalla2026-10-13195620.png',
    caption: 'Elige la fecha de entrega del vendedor, adjunta la foto con Elegir foto y pulsa Guardar.'
  }
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

function buildEmail({ intro, images, recipient }: { intro: string; images: any[]; recipient: any }) {
  const name = String(recipient?.client_name || recipient?.name || '').trim() || 'cliente';
  const email = String(recipient?.email || '').trim();

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
<title>Comprobante de entrega obligatorio</title>
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
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#0f172a;">Hola ${escapeHtml(name)}, el comprobante de entrega ahora es obligatorio</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 24px 0;font-family:Manrope,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;">
              <p style="margin:0;">${escapeHtml(intro)}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 24px 0;font-family:Manrope,Arial,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;font-size:14px;line-height:1.55;color:#7c2d12;">
                    <strong>Obligatorio desde la recepción de este correo.</strong> La fecha de entrega del vendedor y la foto del comprobante son indispensables para que el seguro de tu carga pueda ser válido. Sin ese respaldo no podemos atender un reclamo por pérdida o daño.
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
                ${stepRow(2, 'Ubica tu carga y pulsa <strong>Agregar fecha entrega</strong>.')}
                ${stepRow(3, 'Elige la <strong>fecha en que el vendedor entregó el paquete</strong> en nuestro almacén, adjunta la <strong>foto del comprobante</strong> con <strong>Elegir foto</strong> y pulsa <strong>Guardar</strong>.')}
              </table>
            </td>
          </tr>

          ${imagesHtml ? `<tr>
            <td style="padding:18px 24px 0;font-family:Inter,Arial,sans-serif;">
              <div style="font-size:15px;font-weight:700;color:#0f172a;padding-bottom:10px;">Ejemplos reales y dónde cargas los datos</div>
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
              Si ya cargaste la fecha y la foto de tu carga, ya cumples con este requisito.
            </td>
          </tr>

          <tr>
            <td style="background-color:#f7fafd;border-top:1px solid #e5e7eb;padding:18px 24px;font-family:Manrope,Arial,sans-serif;font-size:12px;line-height:1.6;color:#64748b;">
              ${BRAND_NAME} · ${TAGLINE}<br />
              <a href="${APP_URL}" style="color:#5c9eeb;text-decoration:none;">tleccargo.com</a>${email ? ` · Este correo llegó a ${escapeHtml(email)} porque tienes un Shipping Mark asignado en TLEC CARGO.` : ''}
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
    last_run_status: 'nunca'
  });
}

// Directorio de clientes: se recorren los usuarios (sin administradores ni
// empleados por área) y se descartan los que no tienen correo válido. Se guarda
// un minuto en memoria para que la búsqueda de la selección personalizada y la
// vista previa no recorran el directorio entero en cada movimiento del admin.
let _clientsCache: { at: number; list: any[] } = { at: 0, list: [] };
const CLIENTS_TTL_MS = 60 * 1000;

async function loadClients(base44: any) {
  const now = Date.now();
  if (_clientsCache.list.length > 0 && now - _clientsCache.at < CLIENTS_TTL_MS) {
    return _clientsCache.list;
  }

  const list: any[] = [];
  const PAGE = 200;

  for (let page = 0; page < 60; page++) {
    const batch = await base44.asServiceRole.entities.User.list('-created_date', PAGE, page * PAGE);
    if (!batch || batch.length === 0) break;
    for (const user of batch) {
      if (!user) continue;
      if (user.role === 'admin' || user.custom_role) continue;
      if (user.is_active === false) continue;
      const email = String(user.email || '').trim().toLowerCase();
      if (!isEmail(email)) continue;
      list.push({
        email,
        shipping_mark: String(user.shipping_mark || '').trim(),
        client_name: String(user.full_name || '').trim() || String(user.shipping_mark || '').trim() || email
      });
    }
    if (batch.length < PAGE) break;
  }

  _clientsCache = { at: now, list };
  return list;
}

// Audiencia de siempre: los clientes con Shipping Mark asignado.
async function collectRecipients(base44: any) {
  const map = new Map<string, any>();
  for (const client of await loadClients(base44)) {
    if (!client.shipping_mark) continue;
    if (map.has(client.email)) continue;
    map.set(client.email, client);
  }
  return sortByName([...map.values()]);
}

// Destinatarios elegidos a mano: se buscan en el directorio para llevar su
// nombre y su Shipping Mark al correo y al registro del envío.
async function collectSelected(base44: any, emails: Set<string>) {
  const found = new Map<string, any>();
  for (const client of await loadClients(base44)) {
    if (!emails.has(client.email)) continue;
    if (found.has(client.email)) continue;
    found.set(client.email, client);
  }
  // Un correo seleccionado que no aparezca en el directorio se conserva: así el
  // envío lo reporta como fallido en vez de perder la selección sin avisar.
  for (const email of emails) {
    if (found.has(email)) continue;
    found.set(email, { email, shipping_mark: '', client_name: email });
  }
  return sortByName([...found.values()]);
}

function sortByName(rows: any[]) {
  return rows.sort((a, b) => String(a.client_name).localeCompare(String(b.client_name)));
}

// Junta el resultado de la corrida en curso con lo ya registrado: el panel
// conserva el detalle de todos los clientes atendidos aunque el envío se reparta
// en varias corridas, y los ya atendidos no vuelven a recibir el correo.
function mergeResults(previous: any[], current: any[]) {
  const byEmail = new Map<string, any>();
  for (const row of [...(previous || []), ...(current || [])]) {
    const key = String(row?.email || '').trim().toLowerCase();
    if (!key) continue;
    byEmail.set(key, row);
  }
  return [...byEmail.values()];
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
    // Canal de envío elegido por el admin: 'brevo' (cuota diaria de Brevo) o
    // 'base44' (servicio de correo de Base44, con créditos de integración).
    const provider = String(body.provider || 'brevo') === 'base44' ? 'base44' : 'brevo';
    // Grupo de destinatarios: la audiencia completa (clientes con Shipping Mark)
    // o la selección personalizada que el admin marcó a mano.
    const group = String(body.group || 'elegibles') === 'personalizada' ? 'personalizada' : 'elegibles';
    const selectedEmails = new Set(
      (Array.isArray(body.recipient_emails) ? body.recipient_emails : [])
        .map((value: any) => String(value || '').trim().toLowerCase())
        .filter((value: string) => isEmail(value))
    );
    const saved = await loadConfig(base44);

    const draft = {
      subject: String(body.subject ?? saved.subject ?? DEFAULT_SUBJECT).trim().slice(0, 200) || DEFAULT_SUBJECT,
      intro_text: String(body.intro_text ?? saved.intro_text ?? DEFAULT_INTRO).trim().slice(0, 1000),
      images: body.images ? sanitizeImages(body.images) : sanitizeImages(saved.images?.length ? saved.images : DEFAULT_IMAGES)
    };

    if (action === 'save') {
      await base44.asServiceRole.entities.DeliveryProofCampaign.update(saved.id, {
        subject: draft.subject,
        intro_text: draft.intro_text,
        images: draft.images
      });
      return Response.json({ ok: true, config: draft });
    }

    const audience = group === 'personalizada'
      ? await collectSelected(base44, selectedEmails)
      : await collectRecipients(base44);
    const notified = new Set(
      (saved.results || [])
        .filter((row: any) => row?.status === 'enviado')
        .map((row: any) => String(row.email || '').trim().toLowerCase())
    );
    const excludeNotified = body.exclude_notified === true;
    const targets = excludeNotified ? audience.filter((r) => !notified.has(r.email)) : audience;
    const totals = {
      group,
      selected: selectedEmails.size,
      eligible: audience.length,
      notified: audience.filter((r) => notified.has(r.email)).length,
      targets: targets.length,
      excluded: excludeNotified ? Math.max(0, audience.length - targets.length) : 0
    };

    if (action === 'preview') {
      const sample = targets[0] || {
        email: 'cliente@ejemplo.com',
        client_name: 'Cliente de ejemplo',
        shipping_mark: 'TLEC000000'
      };
      return Response.json({
        ok: true,
        html: buildEmail({
          intro: draft.intro_text,
          images: usableImages(draft.images),
          recipient: sample
        }),
        totals,
        sample: targets.slice(0, 60).map((r) => ({ email: r.email, client_name: r.client_name, shipping_mark: r.shipping_mark })),
        config: {
          subject: draft.subject,
          intro_text: draft.intro_text,
          images: draft.images,
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
        return Response.json({
          error: group === 'personalizada'
            ? 'No hay destinatarios en la selección personalizada para enviar.'
            : 'No hay clientes elegibles para enviar.'
        }, { status: 400 });
      }

      const queue = targets.slice(0, MAX_RECIPIENTS);
      const results: any[] = [];
      let sent = 0;
      let failed = 0;

      for (const recipient of queue) {
        const html = buildEmail({
          intro: draft.intro_text,
          images: usableImages(draft.images),
          recipient
        });
        const outcome = await sendBrevoEmail(base44, {
          to: recipient.email,
          subject: draft.subject,
          body: html,
          from_name: 'TLEC CARGO',
          source: 'campaign',
          campaign_name: CAMPAIGN_NAME,
          provider
        });
        results.push({
          email: recipient.email,
          client_name: recipient.client_name,
          shipping_mark: recipient.shipping_mark || '',
          status: outcome.sent ? 'enviado' : 'fallido',
          error: outcome.sent ? '' : String(outcome.error || 'No se pudo enviar').slice(0, 300),
          date: new Date().toISOString()
        });
        if (outcome.sent) sent++;
        else failed++;
        // Se guarda el avance cada 25 correos: si la corrida se corta, el panel
        // conserva a quién se le envió y a quién no.
        if (results.length % 25 === 0) {
          await base44.asServiceRole.entities.DeliveryProofCampaign.update(saved.id, {
            last_run_date: new Date().toISOString(),
            last_run_by: me.email || '',
            last_run_status: 'parcial',
            last_run_recipients: queue.length,
            last_run_sent: sent,
            last_run_failed: failed,
            last_run_message: `Envío en curso: ${sent} de ${queue.length} correos entregados.`,
            results: mergeResults(saved.results, results)
          });
        }
        if (SEND_DELAY_MS) await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
      }

      const remaining = Math.max(0, targets.length - queue.length);
      const status = failed === 0 ? 'enviada' : sent === 0 ? 'fallida' : 'parcial';
      const channel = provider === 'base44' ? 'Base44' : 'Brevo';
      const message = `Enviado por ${channel}: ${sent} de ${queue.length} correos entregados${failed ? `, ${failed} fallidos` : ''}.${remaining ? ` Quedan ${remaining} clientes para el siguiente lote.` : ''}`;
      const allResults = mergeResults(saved.results, results);

      await base44.asServiceRole.entities.DeliveryProofCampaign.update(saved.id, {
        subject: draft.subject,
        intro_text: draft.intro_text,
        images: draft.images,
        last_run_date: new Date().toISOString(),
        last_run_by: me.email || '',
        last_run_status: status,
        last_run_recipients: queue.length,
        last_run_sent: sent,
        last_run_failed: failed,
        last_run_message: message,
        results: allResults
      });

      return Response.json({
        ok: true,
        status,
        provider,
        group,
        sent,
        failed,
        total: queue.length,
        remaining,
        message,
        totals,
        results: allResults
      });
    }

    return Response.json({ error: `Acción no reconocida: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as any)?.message || 'No se pudo completar la campaña.' }, { status: 500 });
  }
});