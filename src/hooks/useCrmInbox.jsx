import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { assignTicketDepartment, departmentPatch } from '@/lib/ticketDepartments';

// Bandeja del CRM: indicadores, agenda y casos, filtrados en el servidor.
export default function useCrmInbox() {
  const [tag, setTag] = useState('');
  const [mine, setMine] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await base44.functions.invoke('supportCrm', { action: 'inbox', tag, mine });
    setData(res.data);
    setLoading(false);
  }, [tag, mine]);

  useEffect(() => { load(); }, [load]);

  // En vivo: si otro usuario (por ejemplo Supervisión) cambia el departamento de un caso, se refleja aquí.
  useEffect(() => base44.entities.SupportTicket.subscribe((event) => {
    if (event.type !== 'update' || !event.data) return;
    const d = event.data;
    const patch = {
      ...departmentPatch(d.department_id ? { id: d.department_id, name: d.department_name } : null),
      escalated: !!d.escalated,
      escalation_status: d.escalation_status || '',
      supervisor_reply_date: d.supervisor_reply_date || '',
    };
    const closed = !['abierto', 'en_proceso'].includes(d.status);
    setData((prev) => (prev && prev.cases.some((c) => c.id === event.id)
      ? {
        ...prev,
        cases: closed
          ? prev.cases.filter((c) => c.id !== event.id)
          : prev.cases.map((c) => (c.id === event.id ? { ...c, ...patch } : c)),
      }
      : prev));
  }), []);

  const markDone = useCallback(async (row, user) => {
    await base44.entities.SupportFollowUp.update(row.id, {
      status: 'hecho',
      updated_by_email: user?.email || '',
      updated_by_name: user?.full_name || user?.email || 'Equipo',
    });
    toast.success('Tarea cerrada');
    await load();
  }, [load]);

  // Mueve un caso a un departamento (o lo deja sin departamento) desde el tablero.
  const moveCase = useCallback(async (caseId, dep, user) => {
    const patch = departmentPatch(dep);
    setData((prev) => (prev ? { ...prev, cases: prev.cases.map((c) => (c.id === caseId ? { ...c, ...patch } : c)) } : prev));
    try {
      await assignTicketDepartment(caseId, dep, user);
      toast.success(dep ? `Caso movido a ${dep.name}` : 'Caso sin departamento');
    } catch {
      toast.error('No se pudo mover el caso');
      await load();
    }
  }, [load]);

  return { data, loading, tag, setTag, mine, setMine, reload: load, markDone, moveCase };
}