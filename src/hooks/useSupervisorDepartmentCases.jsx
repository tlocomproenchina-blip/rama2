import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { assignTicketDepartment, departmentPatch } from '@/lib/ticketDepartments';

// Casos escalados que siguen abiertos para Supervisión, listos para el tablero por departamento.
const QUERY = {
  escalated: true,
  $or: [{ escalation_status: 'pendiente' }, { atc_review_status: { $ne: 'revisado' } }],
};

export default function useSupervisorDepartmentCases(user) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await base44.entities.SupportTicket.filter(QUERY, '-escalated_date', 200);
    setCases(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const moveCase = useCallback(async (caseId, dep) => {
    const patch = departmentPatch(dep);
    setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, ...patch } : c)));
    try {
      await assignTicketDepartment(caseId, dep, user);
      toast.success(dep ? `Caso movido a ${dep.name}` : 'Caso sin departamento');
    } catch {
      toast.error('No se pudo mover el caso');
      await load();
    }
  }, [user, load]);

  const replaceCase = useCallback((updated) => {
    setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, []);

  return { cases, loading, reload: load, moveCase, replaceCase };
}