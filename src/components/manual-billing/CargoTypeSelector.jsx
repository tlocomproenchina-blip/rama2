import React from 'react';
import { Button } from '@/components/ui/button';
import { Package, AlertTriangle } from 'lucide-react';

// Selector del tipo de carga que se factura: regular (predeterminado) o alto riesgo/sensible.
// La elección define qué tarifa (regular o alto riesgo) se aplica a los envíos de la factura.
export default function CargoTypeSelector({ value = 'general', onChange, compact = false }) {
  const isHighRisk = value === 'alto_riesgo';

  // Variante compacta: para la tarjeta de un recibo individual
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={isHighRisk ? 'outline' : 'default'}
          onClick={() => onChange?.('general')}
          className="h-8 gap-1.5 px-2.5 text-[11px]"
        >
          <Package className="h-3.5 w-3.5" /> Carga común
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange?.('alto_riesgo')}
          className={isHighRisk ? 'h-8 gap-1.5 px-2.5 text-[11px] border-amber-500 bg-amber-500 text-white hover:bg-amber-600 hover:text-white' : 'h-8 gap-1.5 px-2.5 text-[11px]'}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Alto riesgo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de carga de esta factura</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={isHighRisk ? 'outline' : 'default'}
          onClick={() => onChange?.('general')}
          className="gap-1.5"
        >
          <Package className="h-3.5 w-3.5" /> Carga común (regular)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange?.('alto_riesgo')}
          className={isHighRisk ? 'gap-1.5 border-amber-500 bg-amber-500 text-white hover:bg-amber-600 hover:text-white' : 'gap-1.5'}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Carga alto riesgo / sensible
        </Button>
      </div>
      <p className="text-[11px] text-slate-500">
        {isHighRisk
          ? 'Se aplica la tarifa de alto riesgo (≥ 0.130 CBM y tabla de mínimos).'
          : 'Se aplica la tarifa regular (≥ 0.130 CBM y tabla de mínimos).'}
      </p>
    </div>
  );
}