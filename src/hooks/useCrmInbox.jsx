import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

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
    const patch = { department_id: dep?.id || '', department_name: dep?.name || '' };
    setData((prev) => (prev ? { ...prev, cases: prev.cases.map((c) => (c.id === caseId ? { ...c, ...patch } : c)) } : prev));
    try {
      await base44.entities.SupportTicket.update(caseId, {
        ...patch,
        department_assigned_by: user?.email || '',
        department_assigned_date: new Date().toISOString(),
      });
      toast.success(dep ? `Caso movido a ${dep.name}` : 'Caso sin departamento');
    } catch {
      toast.error('No se pudo mover el caso');
      await load();
    }
  }, [load]);

  return { data, loading, tag, setTag, mine, setMine, reload: load, markDone, moveCase };
}