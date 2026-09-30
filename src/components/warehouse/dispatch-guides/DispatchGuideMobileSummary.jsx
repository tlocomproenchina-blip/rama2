import React, { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import DispatchGuideSummary from './DispatchGuideSummary';

// En móvil el resumen no ocupa espacio hasta que hay clientes marcados: aparece un
// botón compacto anclado abajo y el resumen completo se abre en una ventana flotante.
export default function DispatchGuideMobileSummary({
  summary,
  selectedClients,
  generating,
  onGenerate,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);

  // Sin clientes marcados no hay botón ni ventana: la lista usa todo el ancho.
  if (!summary.clients) return null;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sticky bottom-2 z-20 flex w-full items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/95 px-4 py-2.5 text-left shadow-card"
      >
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-slate-800">
            {summary.clients} cliente(s) · {summary.bultos} bulto(s)
          </span>
          <span className="block truncate text-[11px] text-slate-500">
            {summary.packages} paquete(s)
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600">
          Ver resumen
          <ChevronUp className="h-4 w-4" />
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl p-4 pb-8">
          <SheetHeader className="pr-8 text-left">
            <SheetTitle className="text-base">Resumen de la guía</SheetTitle>
            <SheetDescription className="text-xs">
              Un solo PDF continuo con los clientes marcados.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <DispatchGuideSummary
              variant="sheet"
              summary={summary}
              selectedClients={selectedClients}
              generating={generating}
              onGenerate={onGenerate}
              disabled={disabled}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}