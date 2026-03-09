import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { base44 as base44Raw } from '@/api/base44Client';

// Hook de indicadores de atención (sin contadores)
// - Actualiza cada 10s
// - Solo considera si hubo una actualización más reciente que la última vez que el usuario "vio" esa sección
export default function useAttentionFlags({ user }) {
  const isAdmin = user?.role === 'admin';
  const isCustom = !!user?.custom_role;
  const email = user?.email || null;
  const storagePrefix = `attentionSeen:${email || (isAdmin ? 'admin' : (isCustom ? user.custom_role : 'anon'))}:`;
  

  const watches = React.useMemo(() => {
    if (isAdmin || isCustom) {
      return [
        { key: 'AdminSupportTickets', entity: 'SupportTicket' },
        { key: 'AdminPackages', entity: 'Package' },
        { key: 'AdminPayments', entity: 'Consolidation' },
        { key: 'AdminInvoices', entity: 'Invoice' },
        { key: 'AdminConsolidate', entity: 'ConsolidationRequest' },
        { key: 'AdminShipmentApprovals', entity: 'Consolidation' },
        { key: 'AdminAccountsPayable', entity: 'AccountsPayable' },
        { key: 'AdminProviderPayments', entity: 'ProviderPayment' },
        { key: 'AdminProviders', entity: 'ShippingProvider' },
        { key: 'AdminAssistedPayments', entity: 'AssistedPaymentRequest' },
        { key: 'AdminPaymentAlerts', entity: 'Invoice' },
      ];
    }
    // Básico para clientes (opcional): paquetes, facturas y soporte propios
    return [
      { key: 'Support', entity: 'SupportTicket', query: email ? { client_email: email } : null },
      { key: 'MyPackages', entity: 'Package', query: email ? { client_email: email } : null },
      { key: 'MyInvoices', entity: 'Invoice', query: email ? { client_email: email } : null },
    ];
  }, [isAdmin, isCustom, email]);

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
          rows = await base44Raw.entities[w.entity].filter(w.query, '-updated_date', 1);
        } else {
          rows = await base44Raw.entities[w.entity].list('-updated_date', 1);
        }
        const latest = Array.isArray(rows) ? rows[0] : undefined;
        if (!latest) { next[w.key] = false; latestMap[w.key] = 0; return; }
        const latestDate = latest.updated_date || latest.created_date;
        const latestMs = latestDate ? new Date(latestDate).getTime() : 0;
        latestMap[w.key] = latestMs;

        let seenStr = localStorage.getItem(`${storagePrefix}${w.key}`);
        let seenMs = Number(seenStr);
        if (!seenStr || !Number.isFinite(seenMs)) {
          // Primera vez: mostrar indicador si existe actividad reciente
          seenMs = 0;
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
    run();
    const id = setInterval(run, 10000); // 10s
    return () => { mounted = false; clearInterval(id); };
  }, [poll]);

  // Suscripción en tiempo real: repoll en eventos de entidades observadas
  React.useEffect(() => {
    const entities = Array.from(new Set((watches || []).map(w => w.entity)));
    const unsubs = [];
    entities.forEach((entity) => {
      try {
        const off = base44.entities[entity]?.subscribe?.(() => {
          // Pequeño debounce interno para agrupar múltiples eventos
          clearTimeout((window.__attnDebounce ||= {} )[entity]);
          (window.__attnDebounce ||= {} )[entity] = setTimeout(() => { poll(); }, 200);
        });
        if (typeof off === 'function') unsubs.push(off);
      } catch (_) {}
    });
    return () => { unsubs.forEach(u => { try { u(); } catch {} }); };
  }, [watches, poll]);

  // Forzar sincronización al volver a primer plano (PWA/iOS pausa timers)
  React.useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') poll(); };
    const onFocus = () => poll();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [poll]);

  const markSeen = React.useCallback((pageKey) => {
    if (!pageKey) return;
    const latestMs = Number(latestByKey[pageKey]) || Date.now();
    try { localStorage.setItem(`${storagePrefix}${pageKey}`, String(latestMs)); } catch {}
    setFlags(prev => ({ ...prev, [pageKey]: false }));
  }, [latestByKey, storagePrefix]);

  return [flags, markSeen];
}