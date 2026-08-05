import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

// Mapea páginas del sidebar a tipos de notificación que les corresponden.
// Cuando hay notificaciones no leídas de ese tipo, se muestra el punto rojo.
export const PAGE_NOTIFICATION_TYPES = {
  AdminPayments: ['payment_validation', 'payment'],
  AdminAssistedPayments: ['assisted_payment'],
};

// Hook de indicadores de notificaciones basados en la entidad Notification.
// - Consulta notificaciones no leídas del usuario actual
// - Devuelve flags (pageKey -> boolean) y markSeen(pageKey) que invoca el backend
//   para marcar como leídas y sincronizar con la campana de notificaciones.
export default function useNotificationFlags({ user }) {
  const [flags, setFlags] = React.useState({});

  const poll = React.useCallback(async () => {
    if (!user?.email) {
      setFlags({});
      return;
    }
    try {
      const notifs = await base44.entities.Notification.filter(
        { user_email: user.email },
        '-created_date',
        50
      );
      const unreadTypes = new Set(
        (notifs || []).filter((n) => !n.read).map((n) => n.type).filter(Boolean)
      );
      const next = {};
      for (const [pageKey, types] of Object.entries(PAGE_NOTIFICATION_TYPES)) {
        next[pageKey] = types.some((t) => unreadTypes.has(t));
      }
      setFlags(next);
    } catch {
      setFlags({});
    }
  }, [user?.email]);

  React.useEffect(() => {
    let mounted = true;
    const run = async () => { if (mounted) await poll(); };
    const handleEntityEvent = (evt) => {
      if (evt?.detail?.entity === 'Notification') run();
    };
    run();
    const id = setInterval(run, 30000);
    window.addEventListener('entity:event', handleEntityEvent);
    return () => {
      mounted = false;
      clearInterval(id);
      window.removeEventListener('entity:event', handleEntityEvent);
    };
  }, [poll]);

  const markSeen = React.useCallback(async (pageKey) => {
    if (!pageKey) return;
    const types = PAGE_NOTIFICATION_TYPES[pageKey];
    if (!types?.length) return;
    // Optimistic: quitar el punto inmediatamente
    setFlags((prev) => ({ ...prev, [pageKey]: false }));
    try {
      await base44.functions.invoke('markNotificationsViewed', {
        notification_types: types,
      });
      // Re-poll para confirmar el estado real (sincroniza con la campana)
      poll();
    } catch (e) {
      console.error('markNotificationsViewed error:', e);
      // Si falla, re-poll para restaurar el estado real
      poll();
    }
  }, [poll]);

  return { flags, markSeen };
}