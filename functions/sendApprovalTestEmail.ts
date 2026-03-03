import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subject = 'Aprobación de consolidación (PRUEBA)';
    const body = `Hola ${user.full_name || ''},\n\nEste es un correo de PRUEBA para confirmar el flujo de aprobación de consolidación.\n\nTu solicitud ha sido aprobada.\n\nSi recibiste este mensaje, el canal de email está funcionando correctamente.\n\nSaludos,\nEquipo de Soporte`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      subject,
      body
    });

    return Response.json({ success: true, sent_to: user.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});