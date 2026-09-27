import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const report = {
      service_users_invite: typeof base44.asServiceRole?.users?.inviteUser,
      app_users_invite: typeof base44.users?.inviteUser,
      service_entities_user: typeof base44.asServiceRole?.entities?.User
    };

    const testEmail = 'prueba.integracion@example.com';
    try {
      await base44.asServiceRole.users.inviteUser(testEmail, 'user');
      report.invite_result = 'ok';
    } catch (e) {
      report.invite_result = 'error';
      report.invite_error = e?.message || String(e);
    }

    try {
      const found = await base44.asServiceRole.entities.User.filter({ email: testEmail }, '-created_date', 5);
      report.created_users = found?.length || 0;
      for (const u of found || []) {
        await base44.asServiceRole.entities.User.delete(u.id);
      }
    } catch (e) {
      report.cleanup_error = e?.message || String(e);
    }

    return Response.json({ ok: true, report });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}