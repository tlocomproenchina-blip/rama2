import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Bell, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const OPTIONS = [
  {
    key: 'pwa_install_prompt_enabled',
    icon: Download,
    title: 'Aviso flotante para instalar la app',
    description: 'Invita a instalar TLEC CARGO en el teléfono. Si lo apagas, cada usuario puede instalarla desde su perfil.',
    onMessage: 'Aviso de instalación activado',
    offMessage: 'Aviso de instalación desactivado',
  },
  {
    key: 'push_prompt_enabled',
    icon: Bell,
    title: 'Aviso flotante para activar notificaciones',
    description: 'Invita a activar las notificaciones push. Si lo apagas, cada usuario puede activarlas desde su perfil.',
    onMessage: 'Aviso de notificaciones activado',
    offMessage: 'Aviso de notificaciones desactivado',
  },
];

export default function AppPromptsSettings({ appConfig, setAppConfig }) {
  const [savingKey, setSavingKey] = useState(null);

  const handleToggle = async (option, checked) => {
    const previous = appConfig;
    const next = { ...appConfig, [option.key]: checked };
    setAppConfig(next);
    setSavingKey(option.key);

    try {
      const existing = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (existing.length > 0) {
        await base44.entities.AppConfig.update(existing[0].id, { [option.key]: checked, config_key: 'main' });
      } else {
        await base44.entities.AppConfig.create({ ...next, config_key: 'main' });
      }
      toast.success(checked ? option.onMessage : option.offMessage);
    } catch (error) {
      setAppConfig(previous);
      toast.error('No se pudo guardar el cambio');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Avisos en pantalla</CardTitle>
        <CardDescription>
          Los avisos flotantes de instalación y de notificaciones aparecen sobre cualquier pantalla de la app. Apágalos si prefieres
          que cada usuario los active desde su perfil.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const enabled = appConfig?.[option.key] !== false;
          const saving = savingKey === option.key;
          return (
            <div
              key={option.key}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/40 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{option.title}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch checked={enabled} disabled={saving} onCheckedChange={(checked) => handleToggle(option, checked)} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}