import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Printer, CheckSquare, Square, CloudOff, Hash } from 'lucide-react';
import { realPackageCount } from '@/lib/bultoCounts';
import PrintCountBadge from './PrintCountBadge';

// Tarjeta de un bulto individual del historial: la usan los bultos sin N° de contenedor y los
// bultos que se despliegan dentro de su grupo.
export default function BultoHistoryRow({
  bulto: b, selectMode, selected, onToggleSelect, canDelete, onPrint, onEdit, onDelete,
}) {
  return (
    <Card className={`shadow-sm transition-all ${selectMode && selected ? 'ring-2 ring-blue-400 bg-blue-50/30' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div
            className={`flex items-start gap-2 min-w-0 flex-1 ${selectMode ? 'cursor-pointer' : ''}`}
            onClick={selectMode ? () => onToggleSelect(b.id) : undefined}
          >
            {selectMode && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleSelect(b.id); }}
                className="mt-0.5 shrink-0"
                aria-label="Seleccionar bulto"
              >
                {selected
                  ? <CheckSquare className="h-5 w-5 text-blue-600" />
                  : <Square className="h-5 w-5 text-slate-300" />}
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800">Bulto {b.bulto_number}/{b.total_bultos}</span>
                <span className="text-xs font-mono text-slate-500 bg-muted px-1.5 py-0.5 rounded">{b.label_code}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  b.status === 'despachado' ? 'bg-green-100 text-green-700'
                  : b.status === 'en_almacen_ve' ? 'bg-amber-100 text-amber-700'
                  : b.status === 'cerrado' ? 'bg-slate-200 text-slate-600'
                  : 'bg-blue-100 text-blue-700'
                }`}>
                  {b.status === 'despachado' ? 'Despachado' : b.status === 'en_almacen_ve' ? 'En Almacén Venezuela' : b.status === 'cerrado' ? 'Cerrado' : 'Activo'}
                </span>
                {b.is_local_pending && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                    <CloudOff className="h-3 w-3" /> Pendiente de sync
                  </span>
                )}
                <PrintCountBadge count={b.print_count} />
              </div>
              <div className="mt-1 text-sm text-slate-600">
                <span className="font-medium">{b.client_snapshot?.full_name || '—'}</span>
                {b.client_snapshot?.cedula && <span className="text-slate-400"> · C.I. {b.client_snapshot.cedula}</span>}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                <span className="font-mono">{b.shipping_mark}</span>
                <span>{b.client_email}</span>
                {b.client_snapshot?.state && <span>{b.client_snapshot.state}</span>}
                <span>{realPackageCount(b)} paq.</span>
                {Array.isArray(b.cbm_order_numbers) && b.cbm_order_numbers.length > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-blue-600 font-medium">
                    <Hash className="h-3 w-3" /> {b.cbm_order_numbers.join(', ')}
                  </span>
                )}
                {b.invoice_paid ? (
                  <span className="text-green-600 font-medium">Factura pagada</span>
                ) : (
                  <span className="text-red-600 font-medium">Factura pendiente</span>
                )}
              </div>
            </div>
          </div>
          {!selectMode && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="outline" size="sm" onClick={() => onPrint(b)}>
                <Printer className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEdit(b)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              {canDelete && (
                <Button variant="outline" size="sm" onClick={() => onDelete(b)} className="text-red-600 hover:bg-red-50 hover:border-red-200">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}