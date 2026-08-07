// Helper compartido para envío de emails vía Brevo API.
// Usa las credenciales BREVO_API_KEY y BREVO_SENDER_EMAIL configuradas en el app.
// De esta forma ningún envío consume créditos de integración de Base44 (Core.SendEmail).
//
// PLAN B — Contador diario con cambio automático:
// Brevo free permite 300 emails/día. Usamos un límite configurable (default 295).
// Cuando se alcanza el límite, el sistema cambia automáticamente a Core.SendEmail.
// Al reiniciarse la cuota (cambio de fecha), vuelve a usar Brevo automáticamente.
// El contador se persiste en AppConfig (brevo_emails_sent_today + brevo_counter_date).

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

  // === PLAN B: verificar cuota diaria de Brevo ===
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let useBrevo = !!(brevoApiKey && brevoSender);
  let configId: string | null = null;
  let currentCount = 0;

  if (useBrevo) {
    try {
      const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      const cfg = configs?.[0];
      if (cfg) {
        configId = cfg.id;
        const limit = cfg.brevo_daily_limit ?? 295;
        const counterDate = cfg.brevo_counter_date;
        // Si cambió el día, el contador se reinicia a 0
        currentCount = counterDate === today ? (cfg.brevo_emails_sent_today ?? 0) : 0;

        if (currentCount >= limit) {
          // Cuota diaria agotada: usar función nativa
          useBrevo = false;
        }
      }
    } catch (_) {
      // Si no puedo leer la config, intento Brevo de todas formas
    }
  }

  if (useBrevo && brevoApiKey && brevoSender) {
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
      // Éxito: incrementar contador diario en AppConfig
      if (configId) {
        try {
          await base44.asServiceRole.entities.AppConfig.update(configId, {
            brevo_emails_sent_today: currentCount + 1,
            brevo_counter_date: today,
          });
        } catch (_) {}
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

  // Sin Brevo configurado o cuota agotada: fallback a Core.SendEmail
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