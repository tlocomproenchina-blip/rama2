import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cacheManager } from '@/components/CacheManager';
import { clientGroups, clientMenuItems } from '@/components/sidebar/sidebarConfig';

const itemsByPage = Object.fromEntries(clientMenuItems.map((item) => [item.page, item]));

export default function ClientMenuVisibilityManager({ appConfig, setAppConfig }) {
  const [saving, setSaving] = useState(false);
  const hidden = useMemo(() => new Set(appConfig?.client_hidden_pages || []), [appConfig?.client_hidden_pages]);

  const persist = async (nextHidden) => {
    const arr = Array.from(nextHidden);
    const prev = appConfig;
    const nextConfig = { ...appConfig, client_hidden_pages: arr };
    setAppConfig(nextConfig);
    setSaving(true);
    try {
      let saved;
      if (appConfig?.id) {
        saved = await base44.entities.AppConfig.update(appConfig.id, { client_hidden_pages: arr, config_key: 'main' });
      } else {
        const existing = await base44.entities.AppConfig.filter({ config_key: 'main' });
        if (existing.length > 0) {
          saved = await base44.entities.AppConfig.update(existing[0].id, { client_hidden_pages: arr, config_key: 'main' });
        } else {
          saved = await base44.entities.AppConfig.create({ ...appConfig, client_hidden_pages: arr, config_key: 'main' });
        }
      }
      const merged = { ...nextConfig, ...(saved || {}) };
      setAppConfig(merged);
      cacheManager.set('app_config', merged, 3600000);
      window.dispatchEvent(new CustomEvent('tlec-app-config-change', { detail: merged }));
      toast.success('Menú del cliente actualizado');
    } catch (e) {
      setAppConfig(prev);
      toast.error('No se pudo guardar el menú del cliente');
    }
    setSaving(false);
  };

  const togglePage = (page) => {
    const next = new Set(hidden);
    if (next.has(page)) next.delete(page); else next.add(page);
    persist(next);
  };

  const toggleGroup = (pages, makeVisible) => {
    const next = new Set(hidden);
    pages.forEach((p) => { if (makeVisible) next.delete(p); else next.add(p); });
    persist(next);
  };

  const resetAll = () => persist(new Set());

  return (
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Visibilidad del Menú del Cliente</CardTitle>
            <CardDescription>
              Activa o desactiva las secciones y páginas que verán los clientes en su menú lateral.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={resetAll} disabled={saving} className="whitespace-nowrap">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Mostrar todo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:space-y-5 md:p-6">
        {clientGroups.map((group) => {
          const groupPages = group.items.filter((p) => itemsByPage[p]);
          if (groupPages.length === 0) return null;
          const allHidden = groupPages.every((p) => hidden.has(p));
          return (
            <div key={group.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
                  <p className="text-xs text-slate-400">
                    {groupPages.filter((p) => !hidden.has(p)).length} de {groupPages.length} visibles
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-500">{allHidden ? 'Oculto' : 'Visible'}</span>
                  <Switch
                    checked={!allHidden}
                    onCheckedChange={(checked) => toggleGroup(groupPages, checked)}
                  />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {groupPages.map((page) => {
                  const item = itemsByPage[page];
                  const Icon = item.icon;
                  const isHidden = hidden.has(page);
                  return (
                    <div
                      key={page}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 ${isHidden ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isHidden ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'}`}>
                          {Icon ? <Icon className="h-4 w-4" /> : null}
                        </span>
                        <span className={`truncate text-sm ${isHidden ? 'text-slate-400' : 'text-slate-700'}`}>{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isHidden ? <EyeOff className="h-3.5 w-3.5 text-slate-400" /> : <Eye className="h-3.5 w-3.5 text-emerald-500" />}
                        <Switch checked={!isHidden} onCheckedChange={() => togglePage(page)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}