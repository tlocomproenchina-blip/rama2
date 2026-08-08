import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import useEntitySubscription from '@/hooks/useEntitySubscription';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getNotificationUrl } from '@/lib/notificationTarget';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  Package, 
  Truck, 
  CheckCircle, 
  AlertCircle, 
  DollarSign,
  Loader2,
  X
} from 'lucide-react';
import { format } from 'date-fns';

const iconMap = {
  package: Package,
  truck: Truck,
  check: CheckCircle,
  alert: AlertCircle,
  dollar: DollarSign
};

const colorMap = {
  package: 'text-blue-600 bg-blue-100',
  truck: 'text-indigo-600 bg-indigo-100',
  check: 'text-emerald-600 bg-emerald-100',
  alert: 'text-amber-600 bg-amber-100',
  dollar: 'text-green-600 bg-green-100'
};

export default function NotificationBell({ user }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  // IDs eliminados localmente que aún pueden reaparecer por race condition
  // (el servidor no propagó el borrado antes de un refetch). Se filtran al cargar.
  const deletedIdsRef = useRef(new Set());

  const loadNotifications = useCallback(async () => {
    if (!user?.email) return;
    try {
      const res = await base44.functions.invoke('getMyNotifications', {});
      const notifs = (res?.data?.notifications) || [];

      const dedupedMap = new Map();
      for (const notif of notifs) {
        // Filtrar notificaciones eliminadas localmente que aún no se propagaron
        if (deletedIdsRef.current.has(notif.id)) continue;
        const key = `${notif.user_email}|${notif.reference_id || ''}|${notif.title || ''}|${notif.type || ''}`;
        const existing = dedupedMap.get(key);
        if (!existing) {
          dedupedMap.set(key, notif);
          continue;
        }

        const keepUnread = !notif.read && existing.read;
        const keepNewest = new Date(notif.created_date || 0).getTime() > new Date(existing.created_date || 0).getTime();
        if (keepUnread || keepNewest) {
          dedupedMap.set(key, notif);
        }
      }

      setNotifications(Array.from(dedupedMap.values()));
      setLoading(false);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEntitySubscription(
    'Notification',
    () => loadNotifications(),
    {
      enabled: !!user?.email,
      filter: (event) => event?.data?.user_email === user?.email,
      debounceMs: 400,
    },
    [user?.email]
  );

  const handleNotificationClick = async (notif) => {
    // Mark as read (optimistic)
    if (!notif.read) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      await base44.entities.Notification.update(notif.id, { read: true }).catch(() => {});
    }

    // Navigate directly to the related record
    const url = getNotificationUrl(notif, user);
    if (url) {
      setOpen(false);
      navigate(url);
    }
  };

  const markAllAsRead = async () => {
   const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
   if (unreadIds.length === 0) return;

   // Optimistic UI update
   setNotifications(prev => prev.map(n => ({ ...n, read: true })));

   await Promise.all(unreadIds.map(id => base44.entities.Notification.update(id, { read: true }).catch(() => {})));
  };

  const deleteNotification = async (notifId, e) => {
    e.stopPropagation();
    // Registrar como eliminada para que no reaparezca en refetch por race condition
    deletedIdsRef.current.add(notifId);
    // Optimistic UI (forma funcional para no usar state stale del closure)
    setNotifications(prev => prev.filter(n => n.id !== notifId));
    try {
      await base44.entities.Notification.delete(notifId);
    } catch (error) {
      // Si falla el borrado, revertir el tracking para que un próximo intento lo reintente
      deletedIdsRef.current.delete(notifId);
      console.error('Error deleting notification:', error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) {
        loadNotifications(); // Refresh when opening
      }
    }}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`relative transition-all ${unreadCount > 0 ? 'animate-pulse' : ''}`}
        >
          <Bell className={`h-5 w-5 transition-colors ${unreadCount > 0 ? 'text-red-600' : ''}`} />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 bg-red-500 text-white text-xs font-bold animate-bounce shadow-lg"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-96 lg:w-[450px] p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-slate-800">Notificaciones</h3>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="text-xs h-7"
          >
            Marcar todas como leídas
          </Button>
        </div>

        <ScrollArea className="h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Bell className="h-12 w-12 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No tienes notificaciones</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => {
                const Icon = iconMap[notif.icon] || Package;
                const colorClass = colorMap[notif.icon] || 'text-blue-600 bg-blue-100';
                
                return (
                  <div
                    key={notif.id}
                    className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer relative group ${
                      !notif.read ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className="flex gap-3">
                      <div className={`p-2 rounded-lg h-fit ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`text-sm font-medium ${!notif.read ? 'text-slate-900' : 'text-slate-700'}`}>
                            {notif.title}
                          </h4>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => deleteNotification(notif.id, e)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                          {format(new Date(notif.created_date), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                      {!notif.read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-1"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}