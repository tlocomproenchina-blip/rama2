import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const EXAMPLE_IMAGE_ONE = 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/2484aa300_WhatsAppImage2026-04-03at12951PM.jpg';
const EXAMPLE_IMAGE_TWO = 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/d11b83368_WhatsAppImage2026-04-03at12833PM.jpg';

function getCaracasDateMinusDays(days) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const now = new Date();
  const caracasNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
  caracasNow.setDate(caracasNow.getDate() - days);
  return formatter.format(caracasNow);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildEmailBody({ clientName, trackingNumber, companyName, deliveryAddress, appName }) {
  return `
    <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 760px; margin: 0 auto;">
      <h2 style="margin: 0 0 16px; color: #0f172a;">Solicitud de comprobante de entrega</h2>
      <p>Hola ${escapeHtml(clientName || 'cliente')},</p>
      <p>Han pasado 7 días desde tu pre-alerta y necesitamos que nos envíes el comprobante de entrega de tu paquete.</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px;"><strong>Número de tracking:</strong> ${escapeHtml(trackingNumber)}</p>
        <p style="margin: 0 0 8px;"><strong>Compañía:</strong> ${escapeHtml(companyName)}</p>
        <p style="margin: 0;"><strong>Dirección:</strong> ${escapeHtml(deliveryAddress)}</p>
      </div>
      <p>Por favor responde este correo adjuntando capturas o fotos donde se vea claramente la entrega del paquete.</p>
      <p>Las imágenes deben verse como en los ejemplos que te mostramos a continuación:</p>
      <div style="display: grid; gap: 16px; margin: 24px 0;">
        <div>
          <p style="margin: 0 0 8px; font-weight: 600;">Ejemplo de referencia</p>
          <img src="${EXAMPLE_IMAGE_ONE}" alt="Ejemplo de comprobante de entrega" style="width: 100%; max-width: 320px; border-radius: 12px; border: 1px solid #e2e8f0;" />
        </div>
        <div>
          <p style="margin: 0 0 8px; font-weight: 600;">Foto 2 - Debe verse así</p>
          <img src="${EXAMPLE_IMAGE_TWO}" alt="Ejemplo 2 de comprobante de entrega" style="width: 100%; max-width: 320px; border-radius: 12px; border: 1px solid #e2e8f0;" />
        </div>
      </div>
      <p>Si ya nos enviaste esta información, puedes ignorar este mensaje.</p>
      <p style="margin-top: 24px;">Gracias,<br />${escapeHtml(appName)}</p>
    </div>
  `;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let appName = 'TLEC CARGO';
    const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
    if (configs?.[0]?.app_name) {
      appName = configs[0].app_name;
    }

    const thresholdDate = getCaracasDateMinusDays(7);
    const packages = await base44.asServiceRole.entities.Package.filter({ status: 'pre_alerta' }, '-created_date', 500);
    const targetPackages = (packages || []).filter((pkg) => {
      const createdDate = String(pkg.created_date || '').slice(0, 10);
      return createdDate && createdDate <= thresholdDate && !pkg.delivery_proof_request_sent_date;
    });

    let sent = 0;
    const skipped = [];

    for (const pkg of targetPackages) {
      const users = await base44.asServiceRole.entities.User.filter({ email: pkg.client_email }, '-created_date', 1);
      const client = users?.[0];

      if (!client?.email) {
        skipped.push({ tracking_number: pkg.tracking_number, reason: 'Cliente sin email' });
        continue;
      }

      const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.full_name || client.email;
      const companyName = pkg.shipping_company || pkg.company || pkg.carrier || 'No especificada';
      const deliveryAddress = pkg.shipping_address || pkg.delivery_address || pkg.address || client.address || 'No especificada';

      const body = buildEmailBody({
        clientName,
        trackingNumber: pkg.tracking_number || 'N/A',
        companyName,
        deliveryAddress,
        appName,
      });

      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: appName,
        to: client.email,
        subject: `Solicitud de comprobante de entrega - ${pkg.tracking_number || 'Tracking'}`,
        body,
      });

      await base44.asServiceRole.entities.Package.update(pkg.id, {
        delivery_proof_request_sent_date: new Date().toISOString(),
      });

      sent += 1;
    }

    return Response.json({ success: true, reviewed: targetPackages.length, sent, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});