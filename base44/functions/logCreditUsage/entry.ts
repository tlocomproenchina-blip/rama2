import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Lightweight logger: ONLY writes to CreditUsageLog entity (no integration calls).
// Accepts a single entry (legacy) or a batch `{ entries: [...] }` (up to 50),
// so the frontend can send several usages in one call.
// Never throws — failures are silent to avoid breaking the calling flow.

const SOURCES = ['frontend', 'backend', 'automation', 'unknown'];

function toRecord(entry, user) {
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
  } = entry || {};
  if (!integration_name) return null;
  return {
    integration_name: String(integration_name).slice(0, 80),
    estimated_credits: Number(estimated_credits) || 1,
    caller_function: String(caller_function || '').slice(0, 120),
    caller_page: String(caller_page || '').slice(0, 120),
    caller_source: SOURCES.includes(caller_source) ? caller_source : 'unknown',
    user_email: user.email || '',
    user_role: user.role || '',
    status: status === 'error' ? 'error' : 'success',
    error_message: String(error_message || '').slice(0, 500),
    params_summary: String(params_summary || '').slice(0, 500),
    duration_ms: Number(duration_ms) || 0,
    occurred_at: new Date().toISOString()
  };
}

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
    const list = Array.isArray(body?.entries) ? body.entries.slice(0, 50) : [body];
    const records = list.map((e) => toRecord(e, user)).filter(Boolean);

    if (!records.length) {
      return Response.json({ ok: false, reason: 'missing integration_name' }, { status: 400 });
    }

    if (records.length === 1) {
      await base44.asServiceRole.entities.CreditUsageLog.create(records[0]);
    } else {
      await base44.asServiceRole.entities.CreditUsageLog.bulkCreate(records);
    }

    return Response.json({ ok: true, logged: records.length });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Internal error' }, { status: 500 });
  }
});