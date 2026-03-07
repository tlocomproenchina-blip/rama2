import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

// Hook de indicadores de atención (sin contadores)
// - Actualiza cada 10s
// - Solo considera si hubo una actualización más reciente que la última vez que el usuario "vio" esa sección
export default function useAttentionFlags({ user }) {
  const isAdmin = user?.role === 'admin';
  const email = user?.email || null;

  const watches = React.useMemo(() => {
    if (isAdmin) {
      return [
        { key: 'AdminSupportTickets', entity: 'SupportTicket' },
        { key: 'AdminPackages', entity: 'Package' },
        { key: 'AdminPayments', entity: 'Consolidation' },
      ];
    }
    // Básico para clientes (opcional): paquetes, facturas y soporte propios
    return [
      { key: 'Support', entity: 'SupportTicket', query: email ? { client_email: email } : null },
      { key: 'MyPackages', entity: 'Package', query: email ? { client_email: email } : null },
      { key: 'MyInvoices', entity: 'Invoice', query: email ? { client_email: email } : null },
    ];
  }, [isAdmin, email]);

  const [flags, setFlags] = React.useState({});

  // Inicializa "visto" en el primer render para evitar puntos iniciales
  React.useEffect(() => {
    watches.forEach(w => {
      const k = `attentionSeen:${w.key}`;
      if (!sessionStorage.getItem(k)) {
        sessionStorage.setItem(k, String(Date.now()));
      }
    });
  }, [watches]);

  const poll = React.useCallback(async () => {
    const next = {};

    await Promise.all(watches.map(async (w) => {
      try {
        let rows = [];
        if (w.query) {
          rows = await base44.entities[w.entity].filter(w.query, '-updated_date', 1);
        } else {
          rows = await base44.entities[w.entity].list('-updated_date', 1);
        }
        const latest = Array.isArray(rows) ? rows[0] : undefined;
        if (!latest) { next[w.key] = false; return; }
        const latestDate = latest.updated_date || latest.created_date;
        const latestMs = latestDate ? new Date(latestDate).getTime() : 0;
        const seenMs = Number(sessionStorage.getItem(`attentionSeen:${w.key}`)) || Date.now();
        next[w.key] = latestMs > seenMs;
      } catch (_e) {
        // En caso de error en una fuente, no encendemos el punto para evitar falsos positivos
        next[w.key] = false;
      }
    }));

    setFlags(next);
  }, [watches]);

  React.useEffect(() => {
    let mounted = true;
    const run = async () => { if (mounted) await poll(); };
    run();
    const id = setInterval(run, 10000); // 10s
    return () => { mounted = false; clearInterval(id); };
  }, [poll]);

  const markSeen = React.useCallback((pageKey) => {
    if (!pageKey) return;
    sessionStorage.setItem(`attentionSeen:${pageKey}`, String(Date.now()));
    setFlags(prev => ({ ...prev, [pageKey]: false }));
  }, []);

  return [flags, markSeen];
}