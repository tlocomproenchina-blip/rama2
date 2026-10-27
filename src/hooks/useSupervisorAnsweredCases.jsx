import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Bandeja del ATC con TODOS los casos escalados (los del asistente y los
// elevados a mano desde la lista de Tickets). Un caso queda pendiente mientras
// el ATC no lo cierra con `atc_review_status: 'revisado'`: así aparecen los que
// todavía esperan respuesta del supervisor y los que ya la tienen sin revisar.
export default function useSupervisorAnsweredCases(initialFilter = 'pendientes') {
  const [filter, setFilter] = useState(initialFilter);
  const [cases, setCases] = useState([]);
  const [counts, setCounts] = useState({ pendientes: 0, revisados: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const reviewed = filter === 'revisados';
      const [rows, pendientes, revisados] = await Promise.all([
        reviewed
          ? base44.entities.SupportTicket.filter(
            { escalated: true, atc_review_status: 'revisado' },
            '-supervisor_reply_date',
            50,
          )
          : base44.entities.SupportTicket.filter(
            { escalated: true, atc_review_status: { $ne: 'revisado' } },
            '-escalated_date',
            50,
          ),
        base44.entities.SupportTicket.count({ escalated: true, atc_review_status: { $ne: 'revisado' } }),
        base44.entities.SupportTicket.count({ escalated: true, atc_review_status: 'revisado' }),
      ]);

      setCases(rows || []);
      setCounts({ pendientes: pendientes || 0, revisados: revisados || 0 });
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return { filter, setFilter, cases, counts, loading, reload: load };
}