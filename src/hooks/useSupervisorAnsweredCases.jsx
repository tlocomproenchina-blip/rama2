import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Casos escalados que ya tienen respuesta del supervisor, separados por la
// revisión del ATC: pendientes (los que faltan por trabajar) y revisados.
// `atc_review_status` solo existe en los casos que Supervisión ya respondió, así
// que es la marca que los identifica.
export default function useSupervisorAnsweredCases(initialFilter = 'pendientes') {
  const [filter, setFilter] = useState(initialFilter);
  const [cases, setCases] = useState([]);
  const [counts, setCounts] = useState({ pendientes: 0, revisados: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === 'revisados' ? 'revisado' : 'pendiente';
      const [rows, grouped] = await Promise.all([
        base44.entities.SupportTicket.filter(
          { escalated: true, atc_review_status: status },
          '-supervisor_reply_date',
          50,
        ),
        base44.entities.SupportTicket.aggregate({
          query: { escalated: true, atc_review_status: { $in: ['pendiente', 'revisado'] } },
          groupBy: 'atc_review_status',
        }),
      ]);

      setCases(rows || []);
      const byStatus = {};
      (grouped?.rows || []).forEach((row) => {
        byStatus[row.atc_review_status || 'pendiente'] = row.count || 0;
      });
      setCounts({ pendientes: byStatus.pendiente || 0, revisados: byStatus.revisado || 0 });
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return { filter, setFilter, cases, counts, loading, reload: load };
}