import React, { useState } from 'react';
import { AlertTriangle, Cloud, CloudOff, Loader2, Smartphone } from 'lucide-react';
import { useSyncCenter } from '@/hooks/useSyncCenter';
import SyncCenterSheet from './SyncCenterSheet';

// Indicador compacto del Store and Forward: conexión y cuántos eventos esperan.
export default function SyncCenterButton() {
  const [open, setOpen] = useState(false);
  const center = useSyncCenter();
  const { pending, conflicts, online, syncing } = center;

  let view = { Icon: Cloud, text: 'Sincronizado', cls: 'border-border/80 text-success' };
  if (conflicts.length) view = { Icon: AlertTriangle, text: `${conflicts.length} revisar`, cls: 'border-red-200 bg-red-50 text-destructive' };
  else if (!online) view = { Icon: CloudOff, text: pending.length ? `${pending.length} en teléfono` : 'Sin red', cls: 'border-amber-200 bg-amber-50 text-amber-800' };
  else if (syncing && pending.length) view = { Icon: Loader2, text: `Enviando ${pending.length}`, cls: 'border-border/80 text-info', spin: true };
  else if (pending.length) view = { Icon: Smartphone, text: `${pending.length} en teléfono`, cls: 'border-amber-200 bg-amber-50 text-amber-800' };

  const { Icon } = view;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Estado de sincronización: ${view.text}`}
        className={`inline-flex h-10 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-semibold transition-colors hover:bg-accent ${view.cls}`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${view.spin ? 'animate-spin' : ''}`} />
        <span className="hidden whitespace-nowrap sm:inline">{view.text}</span>
        {(pending.length > 0 || conflicts.length > 0) && (
          <span className="sm:hidden">{conflicts.length || pending.length}</span>
        )}
      </button>
      <SyncCenterSheet open={open} onOpenChange={setOpen} center={center} />
    </>
  );
}