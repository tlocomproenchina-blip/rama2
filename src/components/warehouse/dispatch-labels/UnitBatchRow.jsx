import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check } from 'lucide-react';
import LabelNumberInputs from './LabelNumberInputs';

// Una unidad del lote: caja consolidada o bulto suelto, con su estado y, si ya está en
// otra guía, el aviso de cuál es (se puede marcar igual). Al marcarla aparecen los
// campos X/N que se imprimen en su etiqueta.
export default function UnitBatchRow({ unit, checked, number, onToggle, onNumberChange, disabled = false }) {
  const isCaja = !!unit.is_caja;

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 transition-colors ${
        checked ? 'border-primary/40 bg-accent' : 'border-border/70 bg-card/70'
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(unit.label_code)}
        className="flex w-full items-start gap-2.5 text-left"
      >
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
            checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border/80'
          }`}
        >
          {checked && <Check className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-mono text-sm font-semibold text-foreground break-all">{unit.label_code}</p>
            <Badge variant="outline" className="font-display">
              {isCaja
                ? unit.caja_number
                  ? `Caja ${unit.caja_number}/${unit.caja_total || '?'}`
                  : 'Caja'
                : 'Bulto suelto'}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {unit.package_count} paquete(s) ·{' '}
            {unit.cbm > 0 ? `${Number(unit.cbm).toFixed(3)} CBM` : 'sin CBM'}
            {unit.status ? ` · ${unit.status}` : ''}
          </p>
          {unit.in_guide && (
            <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              Ya está en la guía {unit.guide_number || 'emitida'} — si la marcas, entra a la guía nueva
            </p>
          )}
        </div>
      </button>

      {checked && (
        <LabelNumberInputs
          index={number?.index ?? ''}
          total={number?.total ?? ''}
          onChange={(field, value) => onNumberChange(unit.label_code, field, value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}