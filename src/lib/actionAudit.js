export async function logActionAudit(base44, user, payload) {
  return await base44.entities.EmployeeAuditLog.create({
    actor_email: user?.email || 'system',
    actor_name: user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
    ...payload,
  });
}