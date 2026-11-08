import React from 'react';
import { RotateCw, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { discardItem, retryAll, retryItem } from '@/lib/storeForward/engine';
import { describeEvent } from '@/lib/storeForward/labels';
import SyncEventRow from './SyncEventRow';

const Stat = ({ label, value, tone }) => (
  <div className="rounded-xl border border-border/70 bg-card px-3 py-2.5 text-center">
    <p className={`font-display text-2xl font-bold ${tone}`}>{value}</p>
    <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
  </div>
);

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
    <ul className="space-y-2">{children}</ul>
  </section>
);

export default function SyncCenterSheet({ open, onOpenChange, center }) {
  const { pending, conflicts, acks, syncedToday, online, syncing, persisted } = center;

  const discard = (item) => {
    const { title, ref } = describeEvent(item);
    if (window.confirm(`¿Descartar "${title} ${ref}"? No se enviará al servidor.`)) discardItem(item.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:mx-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 font-display">
            {online ? <Wifi className="h-5 w-5 text-success" /> : <WifiOff className="h-5 w-5 text-destructive" />}
            {online ? (syncing ? 'Enviando al servidor…' : 'Con conexión') : 'Sin conexión: sigue trabajando'}
          </SheetTitle>
          <SheetDescription>
            Todo lo que haces en la bodega se guarda primero en este teléfono y se envía solo cuando hay red.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="En este teléfono" value={pending.length} tone="text-amber-600" />
          <Stat label="Requieren revisión" value={conflicts.length} tone="text-destructive" />
          <Stat label="Enviados hoy" value={syncedToday} tone="text-success" />
        </div>

        <Button className="mt-4 w-full" onClick={() => retryAll()} disabled={!online || (!pending.length && !conflicts.length)}>
          <RotateCw /> Reintentar ahora
        </Button>

        <div className="mt-5 space-y-5">
          {conflicts.length > 0 && (
            <Section title="Requieren revisión">
              {conflicts.map((item) => <SyncEventRow key={item.id} item={item} onRetry={retryItem} onDiscard={discard} />)}
            </Section>
          )}
          {pending.length > 0 && (
            <Section title="Pendientes de enviar">
              {pending.map((item) => <SyncEventRow key={`${item.kind || 'q'}-${item.id}`} item={item} />)}
            </Section>
          )}
          {acks.length > 0 && (
            <Section title="Confirmados por el servidor">
              {acks.slice(0, 15).map((item) => <SyncEventRow key={`ack-${item.id}`} item={item} />)}
            </Section>
          )}
        </div>

        <div className="mt-5 flex gap-2 rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p>
            Con pendientes, no borres los datos del navegador ni desinstales la app: lo guardado vive en este teléfono hasta que el servidor lo confirma.
            {persisted === false && ' Este teléfono no garantizó guardado permanente; sincroniza en cuanto tengas red.'}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}