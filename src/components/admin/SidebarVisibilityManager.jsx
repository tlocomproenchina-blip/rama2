import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cacheManager } from '@/components/CacheManager';
import { ADMIN_SECTIONS } from '@/components/sidebar/sectionsConfig';
import MenuSectionVisibility from '@/components/admin/menu-visibility/MenuSectionVisibility';

// Configuración no se puede ocultar: es desde donde se vuelve a mostrar todo.
const LOCKED_PAGES = new Set(['AdminSettings']);
const MENU_PAGES = new Set(ADMIN_SECTIONS.flatMap((s) => s.pages.map((x) => x.page)));

export default function SidebarVisibilityManager({ appConfig, setAppConfig }) {
  const [saving, setSaving] = useState(false);
  const hidden = useMemo(() => new Set(appConfig?.sidebar_hidden_pages || []), [appConfig?.sidebar_hidden_pages]);

  const persist = async (nextHidden) => {
    // Solo se guardan páginas que existen en el menú actual.
    const arr = Array.from(nextHidden).filter((p) => MENU_PAGES.has(p) && !LOCKED_PAGES.has(p));
    const prev = appConfig;
    const nextConfig = { ...appConfig, sidebar_hidden_pages: arr };
    setAppConfig(nextConfig);
    setSaving(true);
    try {
      let saved;
      if (appConfig?.id) {
        saved = await base44.entities.AppConfig.update(appConfig.id, { sidebar_hidden_pages: arr, config_key: 'main' });
      } else {
        const existing = await base44.entities.AppConfig.filter({ config_key: 'main' });
        saved = existing.length > 0
          ? await base44.entities.AppConfig.update(existing[0].id, { sidebar_hidden_pages: arr, config_key: 'main' })
          : await base44.entities.AppConfig.create({ ...appConfig, sidebar_hidden_pages: arr, config_key: 'main' });
      }
      const merged = { ...nextConfig, ...(saved || {}) };
      setAppConfig(merged);
      cacheManager.set('app_config', merged, 3600000);
      window.dispatchEvent(new CustomEvent('tlec-app-config-change', { detail: merged }));
      toast.success('Menú actualizado');
    } catch (e) {
      setAppConfig(prev);
      toast.error('No se pudo guardar el menú');
    }
    setSaving(false);
  };

  const togglePage = (page) => {
    const next = new Set(hidden);
    if (next.has(page)) next.delete(page); else next.add(page);
    persist(next);
  };

  const toggleSection = (pages, makeVisible) => {
    const next = new Set(hidden);
    pages.forEach((p) => { if (makeVisible) next.delete(p); else next.add(p); });
    persist(next);
  };

  return (
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Visibilidad del Menú</CardTitle>
            <CardDescription>
              Las mismas secciones y pestañas del menú lateral de administración. Apaga una sección completa o solo algunas de sus pestañas.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => persist(new Set())} disabled={saving} className="whitespace-nowrap">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Mostrar todo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 p-4 md:p-6 xl:grid-cols-2">
        {ADMIN_SECTIONS.map((section) => (
          <MenuSectionVisibility
            key={section.id}
            section={section}
            hidden={hidden}
            lockedPages={LOCKED_PAGES}
            onTogglePage={togglePage}
            onToggleSection={toggleSection}
          />
        ))}
      </CardContent>
    </Card>
  );
}