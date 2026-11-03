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

  return { data, loading, tag, setTag, mine, setMine, reload: load, markDone };
}