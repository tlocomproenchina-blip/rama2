import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/components/api/ApiQueueManager';

// Conciliación registros vs escaneos de un período. Solo carga mientras el panel está
// abierto y se refresca sola (con espera de 5 s) cuando entra un escaneo o cambia un paquete.
export function usePackageReconciliation(days, enabled) {
  const queryClient = useQueryClient();
  const key = ['package-reconciliation', days];
  const query = useQuery({
    queryKey: key,
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await base44.functions.invoke('getPackageReconciliation', { days });
      return res.data;
    },
  });

  const timerRef = useRef(null);
  useEffect(() => {
    if (!enabled) return undefined;
    const schedule = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => queryClient.invalidateQueries({ queryKey: ['package-reconciliation'] }), 5000);
    };
    const offScan = base44.entities.EscaneoBodega.subscribe(schedule);
    const offPkg = base44.entities.Package.subscribe(schedule);
    return () => {
      clearTimeout(timerRef.current);
      if (typeof offScan === 'function') offScan();
      if (typeof offPkg === 'function') offPkg();
    };
  }, [enabled, queryClient]);

  return query;
}