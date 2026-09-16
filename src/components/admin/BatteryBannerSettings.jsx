import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, BatteryCharging } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

export default function BatteryBannerSettings({ appConfig, setAppConfig, onSave, saving }) {
  const [localHtml, setLocalHtml] = useState(appConfig.battery_banner_html || '');

  // Sync cuando se carga la config por primera vez
  React.useEffect(() => {
    if (appConfig.battery_banner_html && !localHtml) {
      setLocalHtml(appConfig.battery_banner_html);
    }
  }, [appConfig.battery_banner_html]);

  const update = (patch) => setAppConfig({ ...appConfig, ...patch });

  const handleSave = () => {
    update({ battery_banner_html: localHtml });
    setTimeout(() => onSave(), 0);
  };

  return (
    <div className="p-4 md:p-6 bg-slate-800 rounded-xl border border-emerald-500/30 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <BatteryCharging className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-lg">Banner de Permisología de Batería</h3>
            <p className="text-sm text-slate-400">Anuncio destacado en la página de inicio sobre importación de baterías</p>
          </div>
        </div>
        <Switch
          checked={!!appConfig.battery_banner_enabled}
          onCheckedChange={(checked) => update({ battery_banner_enabled: checked })}
        />
      </div>

      {appConfig.battery_banner_enabled && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-200">Fecha de inicio</Label>
              <Input
                type="date"
                value={appConfig.battery_banner_start_date || ''}
                onChange={(e) => update({ battery_banner_start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Fecha de fin</Label>
              <Input
                type="date"
                value={appConfig.battery_banner_end_date || ''}
                onChange={(e) => update({ battery_banner_end_date: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            El banner solo se muestra entre estas fechas. Si el usuario lo cierra, no vuelve a aparecer (hasta que cambies el contenido).
          </p>

          <div className="space-y-2">
            <Label className="text-slate-200">Título del banner</Label>
            <Input
              value={appConfig.battery_banner_title || ''}
              onChange={(e) => update({ battery_banner_title: e.target.value })}
              placeholder="Contamos con toda la permisología para la importación de baterías"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-200">Contenido (editor HTML)</Label>
            <div className="rounded-lg overflow-hidden border border-slate-600 bg-white">
              <ReactQuill
                theme="snow"
                value={localHtml}
                onChange={setLocalHtml}
                modules={{
                  toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ color: [] }, { background: [] }],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['link'],
                    ['clean']
                  ]
                }}
                placeholder="Escribe el contenido del banner..."
                style={{ minHeight: '140px' }}
              />
            </div>
            <p className="text-xs text-slate-400">
              El contenido se muestra sobre fondo oscuro. Usa texto claro para mejor legibilidad.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar banner
          </Button>
        </div>
      )}
    </div>
  );
}