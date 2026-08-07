// Helper compartido para envío de emails vía Brevo API.
// Usa las credenciales BREVO_API_KEY y BREVO_SENDER_EMAIL configuradas en el app.
// De esta forma ningún envío consume créditos de integración de Base44 (Core.SendEmail).
// Si Brevo no está configurado, hace fallback a Core.SendEmail para no romper el flujo.

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  from_name?: string;
}

export async function sendBrevoEmail(base44: any, params: SendEmailParams): Promise<{ sent: boolean; error?: string; via: 'brevo' | 'fallback' }> {
  const { to, subject, body, from_name } = params;
  if (!to || !subject) return { sent: false, error: 'Falta to/subject', via: 'fallback' };

  const brevoApiKey = Deno.env.get('BREVO_API_KEY');
  const brevoSender = Deno.env.get('BREVO_SENDER_EMAIL');
  const rawBody = body || '';
  const isHtml = /<[a-z][\s\S]*>/i.test(rawBody);

  if (brevoApiKey && brevoSender) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: from_name || 'TLEC CARGO', email: brevoSender },
          to: [{ email: to }],
          subject,
          htmlContent: isHtml ? rawBody : rawBody.replace(/\n/g, '<br>'),
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Brevo ${res.status}: ${errText.slice(0, 300)}`);
      }
      return { sent: true, via: 'brevo' };
    } catch (err) {
      // Fallback al servicio integrado si Brevo falla
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to,
          subject,
          body: rawBody,
          from_name: from_name || 'TLEC CARGO',
        });
        return { sent: true, via: 'fallback' };
      } catch (err2) {
        return { sent: false, error: err2?.message || String(err2), via: 'fallback' };
      }
    }
  }

  // Sin Brevo configurado: fallback a Core.SendEmail
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to,
      subject,
      body: rawBody,
      from_name: from_name || 'TLEC CARGO',
    });
    return { sent: true, via: 'fallback' };
  } catch (err) {
    return { sent: false, error: err?.message || String(err), via: 'fallback' };
  }
}