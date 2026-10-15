import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronRight, Hash, CheckSquare, Square } from 'lucide-react';
import { realPackageCount } from '@/lib/bultoCounts';
import BultoHistoryRow from './BultoHistoryRow';

// Tarjeta plegable que reúne todos los bultos de un mismo cliente con el mismo N° de contenedor.
// El encabezado indica el cliente, su shipping mark, el N° de contenedor, los números de bulto
// que contiene y cuántos bultos son; al desplegarse se ven los bultos individuales.
export default function BultoOrderGroupCard({
  entry, expanded, onToggle, selectMode, selectedIds,
  onToggleSelect, onToggleGroup, canDelete, onPrint, onEdit, onDelete,
}) {
  const bultos = entry.bultos;
  const first = bultos[0];
  const count = bultos.length;
  const packages = bultos.reduce((sum, bulto) => sum + realPackageCount(bulto), 0);
  const numbers = bultos.map((bulto) => (
    bulto.bulto_number !== undefined && bulto.bulto_number !== null ? bulto.bulto_number : bulto.label_code
  ));
  const allSelected = bultos.every((bulto) => selectedIds.has(bulto.id));
  const someSelected = bultos.some((bulto) => selectedIds.has(bulto.id));

  return (
    <Card className={`shadow-sm transition-all ${selectMode && someSelected ? 'ring-2 ring-blue-400 bg-blue-50/30' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer" onClick={onToggle}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (selectMode) onToggleGroup(bultos);
                else onToggle();
              }}
              className="mt-0.5 shrink-0"
              aria-label={selectMode ? 'Seleccionar los bultos del grupo' : 'Desplegar el grupo'}
            >
              {selectMode ? (
                allSelected
                  ? <CheckSquare className="h-5 w-5 text-blue-600" />
                  : someSelected
                    ? <CheckSquare className="h-5 w-5 text-blue-300" />
                    : <Square className="h-5 w-5 text-slate-300" />
              ) : (
                expanded
                  ? <ChevronDown className="h-5 w-5 text-slate-400" />
                  : <ChevronRight className="h-5 w-5 text-slate-400" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800">
                  {first.client_snapshot?.full_name || first.client_email || '—'}
                </span>
                {first.client_snapshot?.cedula && (
                  <span className="text-xs text-slate-400">C.I. {first.client_snapshot.cedula}</span>
                )}
                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                  <Hash className="h-3 w-3" /> {entry.order}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-slate-600">
                  {count} bulto{count === 1 ? '' : 's'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                <span className="font-mono">{first.shipping_mark}</span>
                <span>Bultos: <span className="font-mono">{numbers.join(', ')}</span></span>
                <span>{packages} paq.</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="mt-0.5 shrink-0"
            aria-label="Desplegar el grupo"
          >
            {expanded
              ? <ChevronDown className="h-5 w-5 text-slate-400" />
              : <ChevronRight className="h-5 w-5 text-slate-400" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2 border-l-2 border-border pl-3">
            {bultos.map((bulto) => (
              <BultoHistoryRow
                key={bulto.id}
                bulto={bulto}
                selectMode={selectMode}
                selected={selectedIds.has(bulto.id)}
                onToggleSelect={onToggleSelect}
                canDelete={canDelete}
                onPrint={onPrint}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}