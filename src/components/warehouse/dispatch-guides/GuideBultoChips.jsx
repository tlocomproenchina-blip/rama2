import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { isUnregisteredLine } from '@/lib/dispatchGuides';
import AddGuideBultosDialog from './AddGuideBultosDialog';

const fmtDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-VE');
};

// Bultos de un cliente dentro de la guía: cada uno se puede quitar y se pueden sumar
// los que falten desde las cajas pendientes del cliente.
export default function GuideBultoChips({ guide, clientGroup, onGuideUpdated }) {
  const [addOpen, setAddOpen] = useState(false);
  const [toRemove, setToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);
  const bultos = clientGroup?.bultos || [];

  const remove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    // La línea sin bulto registrado se identifica por su N° de contenedor, no por código.
    const unregistered = isUnregisteredLine(toRemove);
    try {
      await base44.functions.invoke('updateDispatchGuideBultos', {
        guide_id: guide.id,
        client_email: clientGroup?.client_email || '',
        ...(unregistered
          ? { remove_unregistered: [String(toRemove.order_number || '').trim()].filter(Boolean) }
          : { remove_codes: [toRemove.label_code] }),
      });
      toast.success(
        unregistered
          ? `Carga del contenedor ${toRemove.order_number || ''} quitada de la guía`
          : `Bulto ${toRemove.label_code} quitado de la guía`
      );
      setToRemove(null);
      onGuideUpdated?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'No se pudo quitar el bulto');
    }
    setRemoving(false);
  };

  return (
    <div className="mt-2 space-y-2">
      {bultos.length === 0 ? (
        <p className="text-[11px] text-slate-400">Este cliente no tiene bultos en la guía.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {bultos.map((bulto, index) =>
            // La carga sin bulto registrado se emitió por su N° de contenedor: se muestra
            // aparte y no se puede quitar desde aquí (no tiene código de bulto).
            isUnregisteredLine(bulto) ? (
              <span
                key={`orden-${clientGroup?.client_key}-${bulto.order_number}-${index}`}
                className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[11px] text-amber-800"
              >
                SIN BULTO · Contenedor {bulto.order_number || '—'} · {bulto.package_count || 0} paq.
                {bulto.invoice_number ? ` · ${bulto.invoice_number}` : ''}
                <button
                  type="button"
                  onClick={() => setToRemove(bulto)}
                  title="Quitar de la guía"
                  className="rounded p-0.5 text-amber-500 transition hover:bg-amber-100 hover:text-amber-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : (
              <span
                key={`${clientGroup?.client_key}-${bulto.label_code}`}
                className="flex items-center gap-1 rounded-lg border border-border bg-card/80 px-2 py-0.5 font-mono text-[11px] text-foreground"
              >
                {bulto.label_code} · {bulto.package_count || 0} paq.
                {bulto.date ? ` · ${fmtDate(bulto.date)}` : ''}
                <button
                  type="button"
                  onClick={() => setToRemove(bulto)}
                  title="Quitar de la guía"
                  className="rounded p-0.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          )}
        </div>
      )}

      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Agregar bultos
      </Button>

      <AddGuideBultosDialog
        guide={guide}
        clientGroup={clientGroup}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={onGuideUpdated}
      />

      <AlertDialog open={Boolean(toRemove)} onOpenChange={(open) => !open && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isUnregisteredLine(toRemove) ? '¿Quitar esta carga sin bulto de la guía?' : '¿Quitar el bulto de la guía?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isUnregisteredLine(toRemove)
                ? `La carga del contenedor ${toRemove?.order_number || '—'} sale de la guía ${guide?.guide_number || ''}. Úsalo cuando esa carga ya entre a la guía con su bulto.`
                : `${toRemove?.label_code} sale de la guía ${guide?.guide_number || ''} y vuelve a quedar pendiente por despachar.`}{' '}
              La guía se recalcula sola.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={removing}>
              {removing && <Loader2 className="h-4 w-4 animate-spin" />}
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}