import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Test 1: Verificar AppConfig (modo demo)
    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const cfg = cfgs?.[0] || {};

    // Test 2: Intentar enviar un email directo y capturar el error real
    let directSendResult = null;
    let directSendError = null;
    try {
      const result = await sendBrevoEmail(base44, {
        to: user.email,
        subject: 'TEST - Diagnóstico de envío',
        body: 'Este es un email de prueba para diagnosticar fallos.',
        from_name: 'TLEC CARGO Diagnóstico'
      });
      directSendResult = result;
      if (!result.sent) {
        throw new Error(result.error || 'Envío fallido');
      }
    } catch (err) {
      directSendError = {
        message: err?.message,
        name: err?.name,
        stack: err?.stack?.split('\n').slice(0, 5).join('\n')
      };
    }

    // Test 3: Estadísticas rápidas de fallos recientes (últimas 50)
    const recentFailed = await base44.asServiceRole.entities.EmailLog.filter(
      { status: 'failed' },
      '-sent_date',
      50
    );

    const subjectCounts = {};
    const recipientCounts = {};
    recentFailed.forEach(log => {
      const subj = (log.subject || '').slice(0, 50);
      subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
      recipientCounts[log.recipient_email] = (recipientCounts[log.recipient_email] || 0) + 1;
    });

    return Response.json({
      diagnosis: {
        demo_mode_active: !!cfg.demo_mode,
        demo_mode_message: cfg.demo_mode_message,
        app_name: cfg.app_name,
        invoice_company_name: cfg.invoice_company_name
      },
      direct_send_test: {
        success: !!directSendResult && !directSendError,
        result: directSendResult,
        error: directSendError
      },
      recent_failed_stats: {
        total_sample: recentFailed.length,
        top_subjects: Object.entries(subjectCounts).sort((a,b) => b[1]-a[1]).slice(0, 5),
        top_recipients: Object.entries(recipientCounts).sort((a,b) => b[1]-a[1]).slice(0, 5)
      }
    });
  } catch (error) {
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});