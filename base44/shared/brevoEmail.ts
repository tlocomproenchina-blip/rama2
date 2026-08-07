// Helper compartido para envío de emails vía Brevo API.
// Usa las credenciales BREVO_API_KEY y BREVO_SENDER_EMAIL configuradas en el app.
// De esta forma ningún envío consume créditos de integración de Base44 (Core.SendEmail).
//
// PLAN B — Contador diario con cambio automático:
// Brevo free permite 300 emails/día. Usamos un límite configurable (default 295).
// Cuando se alcanza el límite, el sistema cambia automáticamente a Core.SendEmail.
// Al reiniciarse la cuota (cambio de fecha), vuelve a usar Brevo automáticamente.
// El contador se persiste en AppConfig (brevo_emails_sent_today + brevo_counter_date).
//
// REGISTRO HISTÓRICO — BrevoDailyLog:
// Cada envío se registra en la entidad BrevoDailyLog con la fecha, si fue vía Brevo
// o nativo, y si ese día se agotó la cuota. Esto permite evaluar cuándo conviene
// mejorar el plan de Brevo.

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  from_name?: string;
}

// Registra o actualiza el log diario de envíos
async function logDailyStat(base44: any, via: 'brevo' | 'fallback', quotaExceeded: boolean, limit: number) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const existing = await base44.asServiceRole.entities.BrevoDailyLog.filter({ log_date: today }, '-updated_date', 1);
    if (existing?.[0]) {
      const update: any = { brevo_limit: limit };
      if (via === 'brevo') update.brevo_sent = (existing[0].brevo_sent || 0) + 1;
      else update.native_sent = (existing[0].native_sent || 0) + 1;
      if (quotaExceeded) update.quota_exceeded = true;
      await base44.asServiceRole.entities.BrevoDailyLog.update(existing[0].id, update);
    } else {
      await base44.asServiceRole.entities.BrevoDailyLog.create({
        log_date: today,
        brevo_sent: via === 'brevo' ? 1 : 0,
        native_sent: via === 'fallback' ? 1 : 0,
        quota_exceeded: quotaExceeded,
        brevo_limit: limit,
      });
    }
  } catch (_) {}
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
  let dailyLimit = 295;
  let quotaExceeded = false;

  if (useBrevo) {
    try {
      const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      const cfg = configs?.[0];
      if (cfg) {
        configId = cfg.id;
        dailyLimit = cfg.brevo_daily_limit ?? 295;
        const counterDate = cfg.brevo_counter_date;
        // Si cambió el día, el contador se reinicia a 0
        currentCount = counterDate === today ? (cfg.brevo_emails_sent_today ?? 0) : 0;

        if (currentCount >= dailyLimit) {
          // Cuota diaria agotada: usar función nativa
          useBrevo = false;
          quotaExceeded = true;
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
      // Registrar en historial diario
      await logDailyStat(base44, 'brevo', false, dailyLimit);
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
        await logDailyStat(base44, 'fallback', false, dailyLimit);
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
    await logDailyStat(base44, 'fallback', quotaExceeded, dailyLimit);
    return { sent: true, via: 'fallback' };
  } catch (err) {
    return { sent: false, error: err?.message || String(err), via: 'fallback' };
  }
}