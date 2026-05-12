import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Lightweight logger: ONLY writes to CreditUsageLog entity (no integration calls).
// Never throws — failures are silent to avoid breaking the calling flow.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Require authenticated user (avoid anonymous spam)
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) {
      return Response.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      integration_name,
      estimated_credits = 1,
      caller_function = '',
      caller_page = '',
      caller_source = 'frontend',
      status = 'success',
      error_message = '',
      params_summary = '',
      duration_ms = 0
    } = body || {};

    if (!integration_name) {
      return Response.json({ ok: false, reason: 'missing integration_name' }, { status: 400 });
    }

    await base44.asServiceRole.entities.CreditUsageLog.create({
      integration_name: String(integration_name).slice(0, 80),
      estimated_credits: Number(estimated_credits) || 1,
      caller_function: String(caller_function || '').slice(0, 120),
      caller_page: String(caller_page || '').slice(0, 120),
      caller_source: ['frontend', 'backend', 'automation', 'unknown'].includes(caller_source) ? caller_source : 'unknown',
      user_email: user.email || '',
      user_role: user.role || '',
      status: status === 'error' ? 'error' : 'success',
      error_message: String(error_message || '').slice(0, 500),
      params_summary: String(params_summary || '').slice(0, 500),
      duration_ms: Number(duration_ms) || 0,
      occurred_at: new Date().toISOString()
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Internal error' }, { status: 500 });
  }
});