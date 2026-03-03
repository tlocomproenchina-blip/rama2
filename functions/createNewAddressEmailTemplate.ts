import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function htmlTemplate({
  appName = 'TLEC Logistics',
  nuevaDireccion = '{nueva_direccion}',
  fechaVigencia = '{fecha_vigencia}',
  enlaceDireccion = '{enlace_direccion}'
} = {}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nueva dirección de recepción</title>
  <style>
    body { background:#f6f7f9; color:#0f172a; font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; margin:0; padding:24px; }
    .container { max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:14px; overflow:hidden; }
    .header { background:linear-gradient(135deg,#1e3a8a,#3b82f6); color:white; padding:20px 24px; }
    .header h1 { margin:0; font-size:20px; }
    .content { padding:24px; line-height:1.6; font-size:15px; }
    .pill { display:inline-block; background:#fff7ed; color:#9a3412; border:1px solid #fdba74; padding:4px 10px; border-radius:999px; font-size:12px; margin:6px 0 12px; }
    .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin:12px 0; }
    .address { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; background:#111827; color:#e5e7eb; border-radius:10px; padding:12px 14px; font-size:14px; overflow-x:auto; }
    .cta { display:inline-block; background:#1d4ed8; color:white; text-decoration:none; padding:10px 14px; border-radius:10px; font-weight:600; margin-top:10px; }
    .warning { background:#fff1f2; border:1px solid #fecdd3; color:#9f1239; padding:12px; border-radius:10px; font-size:14px; }
    .footer { color:#64748b; font-size:12px; padding:16px 24px 24px; }
    ul { margin:8px 0 0 18px; padding:0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${appName} — Importante: Nueva dirección de recepción</h1>
    </div>
    <div class="content">
      <div class="pill">Acción requerida</div>
      <p>Hemos actualizado nuestra dirección de recepción de paquetes. A partir de <strong>${fechaVigencia}</strong> deberás utilizar únicamente la nueva dirección indicada abajo.</p>

      <div class="card">
        <p style="margin:0 0 6px 0; font-weight:600;">Nueva dirección:</p>
        <div class="address">${nuevaDireccion}</div>
        <a class="cta" href="${enlaceDireccion}" target="_blank" rel="noopener">Ver/guardar dirección</a>
      </div>

      <p>Antes de realizar cualquier envío, por favor:</p>
      <ul>
        <li>Verifica que la dirección del remitente esté actualizada en tu proveedor de envíos.</li>
        <li>Incluye tu Shipping Mark/Referencia personal según lo indicado en tu cuenta.</li>
        <li>Confirma la empresa de mensajería y número de tracking cuando esté disponible.</li>
      </ul>

      <div class="warning" style="margin-top:14px;">
        <strong>Importante:</strong> Si envías a una dirección distinta a la aquí indicada, <strong>${appName} no se hace responsable</strong> por retrasos, pérdidas o incidencias derivadas.
      </div>

      <p style="margin-top:14px;">Gracias por tu atención y por ayudarnos a mantener un proceso de recepción más rápido y seguro.</p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} ${appName}. Este es un mensaje informativo; no respondas a este correo. Si necesitas ayuda, contáctanos por los canales habituales.
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Optional payload overrides
    const { app_name, nueva_direccion, fecha_vigencia, enlace_direccion } = await req.json().catch(() => ({}));

    const name = 'Aviso: Nueva dirección de recepción';
    const subject = 'Importante: Nueva dirección del almacén – verifica antes de enviar';
    const description = 'Plantilla para informar a clientes la nueva dirección y la exención de responsabilidad si usan la dirección anterior.';
    const body = htmlTemplate({
      appName: app_name || 'TLEC Logistics',
      nuevaDireccion: nueva_direccion || '{nueva_direccion}',
      fechaVigencia: fecha_vigencia || '{fecha_vigencia}',
      enlaceDireccion: enlace_direccion || '{enlace_direccion}'
    });

    // Upsert by name
    const existing = await base44.asServiceRole.entities.EmailTemplate.filter({ name });
    let record;
    if (existing.length > 0) {
      record = await base44.asServiceRole.entities.EmailTemplate.update(existing[0].id, {
        name,
        description,
        category: 'envios',
        subject,
        body,
        variables: ['nueva_direccion', 'fecha_vigencia', 'enlace_direccion', 'cliente_nombre']
      });
    } else {
      record = await base44.asServiceRole.entities.EmailTemplate.create({
        name,
        description,
        category: 'envios',
        subject,
        body,
        variables: ['nueva_direccion', 'fecha_vigencia', 'enlace_direccion', 'cliente_nombre'],
        is_default: false,
        usage_count: 0
      });
    }

    return Response.json({ ok: true, template_id: record.id, name, subject }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});