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
      // AdminPayments se maneja via useNotificationFlags (basado en entidad Notification)
      return [
        // Solo marcar atención cuando hay tickets abiertos/en_proceso (no al cerrar)
        { key: 'AdminSupportTickets', entity: 'SupportTicket', openOnly: true },
        { key: 'AdminPackages', entity: 'Package' },
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
        let latestMs = 0;

        if (w.stalePreAlertsOnly) {
          let allRows = [];
          let skip = 0;
          while (true) {
            const batch = await base44.entities.Package.filter({ status: 'pre_alerta' }, '-created_date', 200, skip);
            if (!batch?.length) break;
            allRows = allRows.concat(batch);
            if (batch.length < 200) break;
            skip += 200;
          }
          const cutoffMs = Date.now() - (7 * 24 * 60 * 60 * 1000);
          const latestStale = allRows.find((row) => new Date(row.created_date || 0).getTime() <= cutoffMs);
          latestMs = latestStale ? new Date(latestStale.updated_date || latestStale.created_date || 0).getTime() : 0;
        } else if (w.key === 'AdminPackages') {
          const auditRows = await base44.entities.ActivityAuditLog.filter({ entity_name: 'Package' }, '-created_date', 50);
          const relevantAudit = (auditRows || []).find((row) => {
            const changedFields = Array.isArray(row?.changed_fields) ? row.changed_fields : [];
            if (!changedFields.length) return false;
            return changedFields.some((field) => field?.field_name && field.field_name !== 'delivery_proof_request_sent_date');
          });
          latestMs = relevantAudit?.created_date ? new Date(relevantAudit.created_date).getTime() : 0;
        } else if (w.openOnly) {
          // Para SupportTicket: solo considerar tickets abiertos/en_proceso donde
          // el último mensaje es del CLIENTE (no del admin). Las respuestas del
          // admin no deben disparar el punto rojo.
          // Cargamos hasta 50 tickets recientes por estado y filtramos en memoria.
          const baseQuery = w.query || {};
          const [openRows, inProcessRows] = await Promise.all([
            base44.entities[w.entity].filter({ ...baseQuery, status: 'abierto' }, '-updated_date', 50),
            base44.entities[w.entity].filter({ ...baseQuery, status: 'en_proceso' }, '-updated_date', 50)
          ]);
          const allOpenTickets = [...(openRows || []), ...(inProcessRows || [])];
          // Encontrar el ticket con el mensaje de cliente más reciente
          let maxClientMsgMs = 0;
          for (const ticket of allOpenTickets) {
            const msgs = Array.isArray(ticket?.messages) ? ticket.messages : [];
            if (!msgs.length) continue;
            const lastMsg = msgs[msgs.length - 1];
            // Solo cuenta si el último mensaje es del cliente (is_admin !== true)
            if (lastMsg && lastMsg.is_admin !== true && lastMsg.timestamp) {
              const msgMs = new Date(lastMsg.timestamp).getTime();
              if (msgMs > maxClientMsgMs) maxClientMsgMs = msgMs;
            }
          }
          latestMs = maxClientMsgMs;
        } else {
          let rows = [];
          if (w.query) {
            rows = await base44.entities[w.entity].filter(w.query, '-updated_date', 1);
          } else {
            rows = await base44.entities[w.entity].list('-updated_date', 1);
          }
          const latest = Array.isArray(rows) ? rows[0] : undefined;
          latestMs = latest ? new Date(latest.updated_date || latest.created_date || 0).getTime() : 0;
        }

        latestMap[w.key] = latestMs;
        if (!latestMs) {
          next[w.key] = false;
          return;
        }

        const storageKey = `attentionSeen:${w.key}`;
        let seenStr = sessionStorage.getItem(storageKey);
        let seenMs = Number(seenStr);

        if (!seenStr || !Number.isFinite(seenMs)) {
          sessionStorage.setItem(storageKey, String(latestMs));
          next[w.key] = false;
          return;
        }

        next[w.key] = latestMs > seenMs;
      } catch (_e) {
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
    const latestMs = Number(latestByKey[pageKey]);
    if (!Number.isFinite(latestMs) || latestMs <= 0) {
      sessionStorage.setItem(`attentionSeen:${pageKey}`, String(Date.now()));
      setFlags(prev => ({ ...prev, [pageKey]: false }));
      return;
    }
    sessionStorage.setItem(`attentionSeen:${pageKey}`, String(latestMs));
    setFlags(prev => ({ ...prev, [pageKey]: false }));
  }, [latestByKey]);

  return [flags, markSeen];
}