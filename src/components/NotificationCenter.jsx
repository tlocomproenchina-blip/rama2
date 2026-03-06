import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, Loader2, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function NotificationCenter({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Cargar notificaciones
  const loadNotifications = useCallback(async () => {
    if (!user?.email) return;
    
    try {
      setLoading(true);
      const [byUser, byRole, byAll] = await Promise.all([
        base44.entities.AppNotification.filter({ user_email: user.email, is_archived: false }, '-created_date', 50),
        user?.role ? base44.entities.AppNotification.filter({ role_target: user.role, is_archived: false }, '-created_date', 50) : Promise.resolve([]),
        base44.entities.AppNotification.filter({ role_target: 'all', is_archived: false }, '-created_date', 50).catch(() => [])
      ]);
      const merged = [...byUser, ...byRole, ...byAll].filter(n => !n.expires_at || new Date(n.expires_at) > new Date());
      const seen = new Set();
      const deduped = [];
      for (const n of merged) {
        const key = `${n.id}|${n.reference_id || ''}|${n.title || ''}|${n.type || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(n);
        }
      }
      setNotifications(deduped);
      setUnreadCount(deduped.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  // Polling cada 120 segundos
  useEffect(() => {
    loadNotifications();
    
    const interval = setInterval(() => {
      setLastRefresh(Date.now());
      loadNotifications();
    }, 120000); // 120 segundos

    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Suscripción en tiempo real: usuario, rol y 'all' (con fallback polling activo)
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = base44.entities.AppNotification.subscribe((event) => {
      const data = event?.data;
      if (!data) return;
      const toUser = data.user_email === user.email;
      const toRole = !!user?.role && (data.role_target === user.role);
      const toAll = !data.user_email && (data.role_target === 'all' || data.role_target == null);
      if (!(toUser || toRole || toAll)) return;

      if (event.type === 'create') {
        setNotifications((prev) => {
          const exists = prev.some(n => n.id === data.id);
          if (!exists && !data.read) {
            setUnreadCount((c) => c + 1);
          }
          return exists ? prev : [data, ...prev];
        });
        setLastRefresh(Date.now());
        toast.message(data.title || 'Nueva notificación', { description: data.message });
      } else if (event.type === 'update' || event.type === 'delete') {
        loadNotifications();
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user?.email, user?.role, loadNotifications]);

  // Marcar como leída
  const markAsRead = async (notificationId) => {
    try {
      // Optimistic UI update
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await base44.entities.AppNotification.update(notificationId, { read: true });
    } catch (error) {
      toast.error('Error actualizando notificación');
    }
  };

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      if (unreadNotifications.length === 0) return;
      // Optimistic UI update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      await Promise.all(unreadNotifications.map(n => base44.entities.AppNotification.update(n.id, { read: true })));
    } catch (error) {
      toast.error('Error actualizando notificaciones');
    }
  };

   // Marcar todas como leídas al abrir el panel
   useEffect(() => {
     if (isOpen) {
       markAllAsRead();
     }
   }, [isOpen]);

   // Eliminar notificación
  const deleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await base44.entities.AppNotification.delete(notificationId);
      loadNotifications();
      toast.success('Notificación eliminada');
    } catch (error) {
      toast.error('Error eliminando notificación');
    }
  };

  const getPriorityColor = (priority) => {
    const p = (priority || 'medium').toString().toLowerCase();
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-blue-100 text-blue-800 border-blue-300',
      info: 'bg-slate-100 text-slate-800 border-slate-300'
    };
    return colors[p] || colors.medium;
  };

  const getCriticalCount = () => {
    return notifications.filter(n => (n.priority || '').toString().toLowerCase() === 'critical' && !n.read).length;
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Abrir notificaciones"
        className="relative h-12 w-12 p-0 flex items-center justify-center rounded-xl transition-colors hover:bg-slate-100 active:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 touch-manipulation select-none"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Bell className="h-6 w-6 text-slate-700" />
        
        {/* Unread Badge - CRITICAL in Red */}
        <AnimatePresence>
          {getCriticalCount() > 0 ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, backgroundColor: ['#ef4444', '#dc2626'] }}
              exit={{ scale: 0 }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="pointer-events-none absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
            >
              {getCriticalCount() > 9 ? '9+' : getCriticalCount()}
            </motion.div>
          ) : unreadCount > 0 ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="pointer-events-none absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Notificaciones</h3>
              <div className="flex items-center gap-2">
                {getCriticalCount() > 0 && (
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                    {getCriticalCount()} críticas
                  </span>
                )}
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs h-6 px-2"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Marcar todas como leídas
                  </Button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              )}

              {!loading && notifications.length === 0 && (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-slate-500 text-sm">No hay notificaciones</p>
                </div>
              )}

              {!loading && notifications.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {notifications.slice(0, 10).map((notif) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                        ((notif.priority || '').toString().toLowerCase() === 'critical') ? 'bg-red-50 border-l-4 border-l-red-500' :
                        !notif.read ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => markAsRead(notif.id)}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                          getPriorityColor(notif.priority || 'medium')
                        }`}>
                          {notif.icon === 'package' && '📦'}
                          {notif.icon === 'truck' && '🚚'}
                          {notif.icon === 'check' && '✅'}
                          {notif.icon === 'alert' && '🔔'}
                          {notif.icon === 'dollar' && '💰'}
                          {notif.icon === 'info' && 'ℹ️'}
                          {!notif.icon && '🔔'}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-slate-800 text-sm">
                              {notif.title}
                            </h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={(e) => deleteNotification(notif.id, e)}
                            >
                              <Trash2 className="h-3 w-3 text-slate-400" />
                            </Button>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {notif.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-slate-400">
                              {format(new Date(notif.created_date), 'dd/MM HH:mm')}
                            </span>
                            {!notif.read && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>


            {/* Last Refresh */}
            <div className="px-4 py-2 text-xs text-slate-400 text-center border-t border-slate-200">
              Actualizado: {format(new Date(lastRefresh), 'HH:mm:ss')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}