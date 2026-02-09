import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, Loader2, Check, Trash2, ArrowRight } from 'lucide-react';
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
      const data = await base44.entities.Notification.filter(
        { user_email: user.email },
        '-created_date',
        50
      );
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
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

  // Marcar como leída
  const markAsRead = async (notificationId) => {
    try {
      await base44.entities.Notification.update(notificationId, { read: true });
      loadNotifications();
    } catch (error) {
      toast.error('Error actualizando notificación');
    }
  };

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      for (const notif of unreadNotifications) {
        await base44.entities.Notification.update(notif.id, { read: true });
      }
      loadNotifications();
      toast.success('Todas las notificaciones marcadas como leídas');
    } catch (error) {
      toast.error('Error actualizando notificaciones');
    }
  };

  // Eliminar notificación
  const deleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await base44.entities.Notification.delete(notificationId);
      loadNotifications();
      toast.success('Notificación eliminada');
    } catch (error) {
      toast.error('Error eliminando notificación');
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      medium: 'bg-blue-100 text-blue-800 border-blue-300',
      low: 'bg-slate-100 text-slate-800 border-slate-300'
    };
    return colors[priority] || colors.medium;
  };

  const getCriticalCount = () => {
    return notifications.filter(n => n.priority === 'critical' && !n.read).length;
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <Bell className="h-5 w-5 text-slate-700" />
        
        {/* Unread Badge - CRITICAL in Red */}
        <AnimatePresence>
          {getCriticalCount() > 0 ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, backgroundColor: ['#ef4444', '#dc2626'] }}
              exit={{ scale: 0 }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
            >
              {getCriticalCount() > 9 ? '9+' : getCriticalCount()}
            </motion.div>
          ) : unreadCount > 0 ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
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
              {getCriticalCount() > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                    {getCriticalCount()} críticas
                  </span>
                </div>
              )}
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs h-6 px-2"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Marcar todas
                </Button>
              )}
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

            {/* Footer */}
            {notifications.length > 10 && (
              <div className="p-3 border-t border-slate-200 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Ver todas las notificaciones
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}

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