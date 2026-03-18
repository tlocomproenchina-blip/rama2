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
  const [latestByKey, setLatestByKey] = React.useState({});

  // Inicialización diferida: establecemos "visto" en el primer poll usando el latestMs

  const poll = React.useCallback(async () => {
    const next = {};
    const latestMap = {};

    await Promise.all(watches.map(async (w) => {
      try {
        let rows = [];
        if (w.query) {
          rows = await base44.entities[w.entity].filter(w.query, '-updated_date', 1);
        } else {
          rows = await base44.entities[w.entity].list('-updated_date', 1);
        }
        const latest = Array.isArray(rows) ? rows[0] : undefined;
        if (!latest) { next[w.key] = false; latestMap[w.key] = 0; return; }
        const latestDate = latest.updated_date || latest.created_date;
        const latestMs = latestDate ? new Date(latestDate).getTime() : 0;
        latestMap[w.key] = latestMs;

        let seenStr = sessionStorage.getItem(`attentionSeen:${w.key}`);
        let seenMs = Number(seenStr);
        if (!seenStr || !Number.isFinite(seenMs)) {
          // Primera vez: fijamos visto al último timestamp conocido del servidor para evitar falsos positivos
          sessionStorage.setItem(`attentionSeen:${w.key}`, String(latestMs));
          seenMs = latestMs;
        }
        next[w.key] = latestMs > seenMs;
      } catch (_e) {
        // En caso de error en una fuente, no encendemos el punto para evitar falsos positivos
        next[w.key] = false;
        latestMap[w.key] = 0;
      }
    }));

    setLatestByKey(latestMap);
    setFlags(next);
  }, [watches]);

  React.useEffect(() => {
    let mounted = true;
    const run = async () => { if (mounted) await poll(); };
    const handleEntityEvent = (evt) => {
      const entity = evt?.detail?.entity;
      if (watches.some((watch) => watch.entity === entity)) {
        run();
      }
    };

    run();
    const id = setInterval(run, 30000);
    window.addEventListener('entity:event', handleEntityEvent);

    return () => {
      mounted = false;
      clearInterval(id);
      window.removeEventListener('entity:event', handleEntityEvent);
    };
  }, [poll, watches]);

  const markSeen = React.useCallback((pageKey) => {
    if (!pageKey) return;
    const latestMs = Number(latestByKey[pageKey]) || Date.now();
    sessionStorage.setItem(`attentionSeen:${pageKey}`, String(latestMs));
    setFlags(prev => ({ ...prev, [pageKey]: false }));
  }, [latestByKey]);

  return [flags, markSeen];
}