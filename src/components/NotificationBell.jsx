import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { toast } from 'sonner';

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
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
      
      // Subscribe to real-time notifications
      const unsubscribe = base44.entities.Notification.subscribe((event) => {
        if (event.data.user_email === user.email) {
          if (event.type === 'create') {
            setNotifications(prev => [event.data, ...prev]);
          } else if (event.type === 'update') {
            setNotifications(prev => prev.map(n => n.id === event.id ? event.data : n));
          } else if (event.type === 'delete') {
            setNotifications(prev => prev.filter(n => n.id !== event.id));
          }
        }
      });
      
      return unsubscribe;
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    const notifs = await base44.entities.Notification.filter(
      { user_email: user.email },
      '-created_date',
      20
    );
    setNotifications(notifs);
    setLoading(false);
  };

  const markAsRead = async (notif) => {
    if (!notif.read) {
      await base44.entities.Notification.update(notif.id, { read: true });
      setNotifications(notifications.map(n => 
        n.id === notif.id ? { ...n, read: true } : n
      ));
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    
    for (const id of unreadIds) {
      await base44.entities.Notification.update(id, { read: true });
    }
    setNotifications(notifications.map(n => ({ ...n, read: true })));
    toast.success('Todas las notificaciones marcadas como leídas');
  };

  const deleteNotification = async (notifId, e) => {
    e.stopPropagation();
    await base44.entities.Notification.delete(notifId);
    setNotifications(notifications.filter(n => n.id !== notifId));
    toast.success('Notificación eliminada');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 lg:w-96 p-0">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-slate-800">Notificaciones</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={markAllAsRead}
              className="text-xs h-7"
            >
              Marcar todas como leídas
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
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
                    onClick={() => markAsRead(notif)}
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