import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, X, Check } from 'lucide-react';
import ClientsFiltersPanel from './ClientsFiltersPanel';

/**
 * Trigger + Sheet inferior que envuelve ClientsFiltersPanel SOLO en mobile.
 * En desktop (≥lg) muestra el panel directamente sin wrapper.
 * Cuenta filtros activos para badge en el botón.
 */
export default function ClientsFiltersMobileTrigger(props) {
  const [open, setOpen] = useState(false);

  const activeCount = countActiveFilters(props);

  return (
    <>
      {/* Desktop: panel inline */}
      <div className="hidden lg:block">
        <ClientsFiltersPanel {...props} />
      </div>

      {/* Mobile: botón que abre Sheet */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-12">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeCount > 0 && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 ml-1">{activeCount}</Badge>
                )}
              </span>
              {activeCount > 0 ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="text-xs text-rose-600 underline cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); props.onResetFilters?.(); }}
                >
                  Limpiar
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto p-0">
            <SheetHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 py-3 flex-row items-center justify-between space-y-0">
              <SheetTitle className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" /> Filtros
                {activeCount > 0 && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">{activeCount}</Badge>
                )}
              </SheetTitle>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </SheetHeader>
            <div className="p-4 pb-24">
              <ClientsFiltersPanel {...props} />
            </div>
            <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur border-t p-3 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { props.onResetFilters?.(); }}>
                Limpiar
              </Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={() => setOpen(false)}>
                <Check className="h-4 w-4 mr-2" /> Aplicar
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function countActiveFilters({
  exclusiveKey,
  stateFilter,
  fromDate,
  toDate,
  quickDate,
}) {
  let n = 0;
  if (exclusiveKey && exclusiveKey !== 'all') n++;
  if (stateFilter && stateFilter !== 'all') n++;
  if (fromDate || toDate) n++;
  if (quickDate && quickDate !== 'all') n++;
  return n;
}