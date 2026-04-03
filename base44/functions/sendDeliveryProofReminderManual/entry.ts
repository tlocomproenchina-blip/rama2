import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const EXAMPLE_IMAGE_ONE = 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/2484aa300_WhatsAppImage2026-04-03at12951PM.jpg';
const EXAMPLE_IMAGE_TWO = 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/d11b83368_WhatsAppImage2026-04-03at12833PM.jpg';

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildEmailBody({ clientName, trackingNumber, companyName, deliveryAddress, appName, supportUrl }) {
  return `
    <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 760px; margin: 0 auto;">
      <h2 style="margin: 0 0 16px; color: #0f172a;">Solicitud de comprobante de entrega</h2>
      <p>Hola ${escapeHtml(clientName || 'cliente')},</p>
      <p>Necesitamos que nos envíes el comprobante de entrega de tu paquete.</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px;"><strong>Número de tracking:</strong> ${escapeHtml(trackingNumber)}</p>
        <p style="margin: 0 0 8px;"><strong>Compañía:</strong> ${escapeHtml(companyName)}</p>
        <p style="margin: 0;"><strong>Dirección:</strong> ${escapeHtml(deliveryAddress)}</p>
      </div>
      <p>Hemos creado un ticket de soporte urgente con esta solicitud para que nos envíes el comprobante directamente desde tu cuenta.</p>
      <p><a href="${supportUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 600;">Abrir ticket de soporte</a></p>
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
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const packageIds = Array.isArray(body?.packageIds) ? body.packageIds.filter(Boolean) : [];

    if (packageIds.length === 0) {
      return Response.json({ error: 'No package IDs provided' }, { status: 400 });
    }

    let appName = 'TLEC CARGO';
    const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
    if (configs?.[0]?.app_name) appName = configs[0].app_name;

    const appId = Deno.env.get('BASE44_APP_ID');
    const appOwner = req.headers.get('x-base44-app-owner') || req.headers.get('X-Base44-App-Owner') || '';

    let sent = 0;
    const skipped = [];

    for (const packageId of packageIds) {
      const pkg = await base44.asServiceRole.entities.Package.get(packageId);
      if (!pkg || pkg.status !== 'pre_alerta') {
        skipped.push({ package_id: packageId, reason: 'Paquete no válido para pre-alerta' });
        continue;
      }

      const users = await base44.asServiceRole.entities.User.filter({ email: pkg.client_email }, '-created_date', 1);
      const client = users?.[0];

      if (!client?.email) {
        skipped.push({ tracking_number: pkg.tracking_number, reason: 'Cliente sin email' });
        continue;
      }

      const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.full_name || client.email;
      const companyName = pkg.shipping_company || pkg.company || pkg.carrier || 'No especificada';
      const deliveryAddress = pkg.shipping_address || pkg.delivery_address || pkg.address || client.address || 'No especificada';

      const now = new Date();
      const ticketNumber = `TK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const initialMessage = `Solicitud automática de comprobante de entrega.\n\nTracking: ${pkg.tracking_number || 'N/A'}\nCompañía: ${companyName}\nDirección: ${deliveryAddress}`;

      const ticket = await base44.asServiceRole.entities.SupportTicket.create({
        ticket_number: ticketNumber,
        client_email: client.email,
        subject: `Solicitud urgente de comprobante - ${pkg.tracking_number || 'Tracking'}`,
        status: 'abierto',
        priority: 'urgente',
        category: 'tracking',
        related_tracking: pkg.tracking_number || '',
        messages: [{
          sender_email: 'admin',
          sender_name: 'Administrador',
          message: initialMessage,
          timestamp: now.toISOString(),
          is_admin: true,
          attachments: []
        }]
      });

      const supportUrl = appOwner
        ? `https://app.base44.com/apps/${appOwner}/${appId}/Support?ticket=${ticket.id}`
        : `/Support?ticket=${ticket.id}`;

      const emailBody = buildEmailBody({
        clientName,
        trackingNumber: pkg.tracking_number || 'N/A',
        companyName,
        deliveryAddress,
        appName,
        supportUrl,
      });

      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: appName,
        to: client.email,
        subject: `URGENTE: solicitud de comprobante - ${pkg.tracking_number || 'Tracking'}`,
        body: emailBody,
      });

      await base44.asServiceRole.entities.Package.update(pkg.id, {
        delivery_proof_request_sent_date: new Date().toISOString(),
      });

      sent += 1;
    }

    return Response.json({ success: true, sent, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});