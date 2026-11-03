import { base44 } from '@/api/base44Client';

// Guarda en el caso el departamento al que se arrastró (o lo deja sin departamento).
export const departmentPatch = (dep) => ({ department_id: dep?.id || '', department_name: dep?.name || '' });

export async function assignTicketDepartment(caseId, dep, user) {
  await base44.entities.SupportTicket.update(caseId, {
    ...departmentPatch(dep),
    department_assigned_by: user?.email || '',
    department_assigned_date: new Date().toISOString(),
  });
}