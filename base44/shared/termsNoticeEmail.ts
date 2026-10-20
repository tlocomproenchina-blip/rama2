// Diseño del correo de aviso de actualización de términos de servicio.
// Un solo lugar define el HTML: lo usan el envío inmediato y la cola de correos.

export const APP_URL = 'https://tleccargo.com';
const BRAND_NAME = 'TLEC CARGO by TELOCOMPROENCHINA';
const TAGLINE = 'Tu carga asegurada desde China hasta Venezuela';
const LOGO_URL = 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/362c2e6ac_WhatsAppImage2026-08-17at90120AM.jpeg';

export const DEFAULT_TERMS_SUBJECT = 'Actualizamos nuestros términos de servicio';

export const DEFAULT_TERMS_MESSAGE =
  'Hemos actualizado nuestros términos y condiciones de servicio. Los nuevos términos ya están vigentes y aplican a tus próximos envíos: mantienen tus derechos, aclaran los tiempos de almacenaje y custodia de tu carga y explican cómo funciona el seguro.\n\nTe pedimos revisarlos con calma. Seguir usando tu cuenta y enviar carga con nosotros significa que estás de acuerdo con la versión actualizada.';

export const DEFAULT_TERMS_URL = `${APP_URL}/TermsOfService`;

export function escapeHtml(value: any) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// El mensaje lo escribe un administrador en texto plano: se escapa y se respetan
// los saltos de línea y los párrafos.
function messageHtml(message: string) {
  return escapeHtml(message)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 12px;">${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export function buildTermsNoticeEmail({ recipientName, message, termsUrl }: { recipientName?: string; message?: string; termsUrl?: string }) {
  const name = String(recipientName || '').trim() || 'cliente';
  const rawUrl = String(termsUrl || '').trim();
  const url = /^https?:\/\/\S+$/i.test(rawUrl) ? rawUrl : DEFAULT_TERMS_URL;
  const body = messageHtml(String(message || '').trim() || DEFAULT_TERMS_MESSAGE);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(DEFAULT_TERMS_SUBJECT)}</title>
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
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#0f172a;">Hola ${escapeHtml(name)}, actualizamos nuestros términos de servicio</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:10px 24px 0;font-family:Manrope,Arial,sans-serif;font-size:14px;line-height:1.6;color:#64748b;">
              Los nuevos términos ya están vigentes y aplican a tus envíos con TLEC CARGO.
            </td>
          </tr>

          <tr>
            <td style="padding:16px 24px 0;font-family:Manrope,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;">
              ${body}
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:6px 24px 22px;font-family:Inter,Arial,sans-serif;">
              <a href="${url}" style="display:inline-block;background-color:#5c9eeb;color:#000000;text-decoration:none;font-size:15px;font-weight:700;padding:14px 28px;border-radius:12px;">Ver los términos actualizados</a>
            </td>
          </tr>

          <tr>
            <td style="padding:0 24px 24px;font-family:Manrope,Arial,sans-serif;font-size:13px;line-height:1.6;color:#64748b;">
              Si tienes dudas sobre estos cambios, escríbenos desde la sección Soporte de tu cuenta y te ayudamos.
            </td>
          </tr>

          <tr>
            <td style="background-color:#f7fafd;border-top:1px solid #e5e7eb;padding:18px 24px;font-family:Manrope,Arial,sans-serif;font-size:12px;line-height:1.6;color:#64748b;">
              ${BRAND_NAME} · ${TAGLINE}<br />
              <a href="${APP_URL}" style="color:#5c9eeb;text-decoration:none;">tleccargo.com</a> · Recibiste este correo porque tienes una cuenta en TLEC CARGO.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}