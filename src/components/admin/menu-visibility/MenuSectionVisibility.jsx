import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, Lock } from 'lucide-react';

// Una sección del menú lateral (igual que en ADMIN_SECTIONS) con un interruptor
// general y uno por cada pestaña. Las páginas bloqueadas no se pueden ocultar.
export default function MenuSectionVisibility({ section, hidden, lockedPages, onTogglePage, onToggleSection }) {
  const SectionIcon = section.icon;
  const pages = section.pages.map((x) => x.page);
  const hideable = pages.filter((p) => !lockedPages.has(p));
  const visibleCount = pages.filter((p) => !hidden.has(p)).length;
  const allHidden = hideable.length > 0 && hideable.every((p) => hidden.has(p));

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
            <SectionIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{section.label}</p>
            <p className="text-xs text-muted-foreground">{visibleCount} de {pages.length} visibles</p>
          </div>
        </div>
        {hideable.length > 0 && (
          <Switch checked={!allHidden} onCheckedChange={(checked) => onToggleSection(hideable, checked)} />
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {section.pages.map(({ page, label }) => {
          const locked = lockedPages.has(page);
          const isHidden = !locked && hidden.has(page);
          return (
            <div
              key={page}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${isHidden ? 'bg-muted/60' : 'bg-card'}`}
            >
              <span className={`truncate text-sm ${isHidden ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{label}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                {locked ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Siempre visible</span>
                ) : (
                  <>
                    {isHidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
                    <Switch checked={!isHidden} onCheckedChange={() => onTogglePage(page)} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}