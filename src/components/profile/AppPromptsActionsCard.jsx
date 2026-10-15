import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle2, Download, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { getInstallState, promptInstall, subscribeInstallState } from '@/lib/pwaInstall';
import { enablePushNotifications, pushPermission, pushSupported } from '@/lib/pushNotifications';

export default function AppPromptsActionsCard() {
  const [installState, setInstallState] = useState(getInstallState);
  const [permission, setPermission] = useState(pushPermission);
  const [installing, setInstalling] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => subscribeInstallState(() => setInstallState(getInstallState())), []);

  useEffect(() => {
    setPermission(pushPermission());
  }, []);

  const handleInstall = async () => {
    if (installState.installed) {
      toast.info('La app ya está instalada en este dispositivo');
      return;
    }
    if (installState.ios) {
      toast.info('En iPhone: toca Compartir y luego «Añadir a pantalla de inicio»');
      return;
    }
    setInstalling(true);
    const result = await promptInstall();
    setInstalling(false);
    if (result === 'accepted') {
      toast.success('Instalación iniciada');
    } else if (result === 'dismissed') {
      toast.info('Cancelaste la instalación');
    } else if (result === 'unavailable') {
      toast.info('Tu navegador no permite instalar desde aquí. Abre la app en Chrome o Safari y usa «Añadir a pantalla de inicio».');
    } else if (result === 'installed') {
      toast.info('La app ya está instalada en este dispositivo');
    } else {
      toast.error('No se pudo iniciar la instalación. Inténtalo de nuevo.');
    }
  };

  const handleEnablePush = async () => {
    if (!pushSupported()) {
      toast.error('Este dispositivo no admite notificaciones');
      return;
    }
    if (Notification.permission === 'granted') {
      toast.info('Las notificaciones ya están activas');
      return;
    }
    if (Notification.permission === 'denied') {
      toast.error('Bloqueaste las notificaciones. Actívalas en los ajustes del navegador.');
      return;
    }
    setEnabling(true);
    const result = await enablePushNotifications();
    setEnabling(false);
    setPermission(pushPermission());
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  };

  const notificationsActive = permission === 'granted';

  return (
    <Card className="border-border/70 bg-card/95 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-5 w-5 text-blue-600" />
          App y notificaciones
        </CardTitle>
        <CardDescription>Instala la aplicación y activa las alertas cuando tú quieras.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
              <Download className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Instalar la aplicación</p>
              <p className="text-xs text-muted-foreground">
                {installState.installed
                  ? 'Ya la tienes instalada en este dispositivo.'
                  : 'Ábrela como app desde la pantalla de inicio de tu teléfono.'}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={installState.installed ? 'secondary' : 'default'}
            onClick={handleInstall}
            disabled={installing || installState.installed}
            className="shrink-0"
          >
            {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : installState.installed ? 'Instalada' : 'Instalar'}
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-2 ${notificationsActive ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
              {notificationsActive ? <CheckCircle2 className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Notificaciones</p>
              <p className="text-xs text-muted-foreground">
                {permission === 'unsupported'
                  ? 'Este dispositivo no admite notificaciones.'
                  : notificationsActive
                    ? 'Activadas: recibirás alertas de tus paquetes.'
                    : permission === 'denied'
                      ? 'Bloqueadas en el navegador. Actívalas en los ajustes del sitio.'
                      : 'Recibe alertas cuando tus paquetes sean recibidos o consolidados.'}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={notificationsActive ? 'secondary' : 'default'}
            onClick={handleEnablePush}
            disabled={enabling || notificationsActive || permission === 'unsupported'}
            className="shrink-0"
          >
            {enabling ? <Loader2 className="h-4 w-4 animate-spin" /> : notificationsActive ? 'Activas' : 'Activar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}