import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Hash, MapPin, Pencil, Trash2 } from 'lucide-react';

const STATUS_LABEL = {
  despachado: 'Despachado',
  en_almacen_ve: 'En Almacén Venezuela',
  cerrado: 'Cerrado',
};

const STATUS_CLASS = {
  despachado: 'bg-emerald-100 text-emerald-700',
  en_almacen_ve: 'bg-amber-100 text-amber-700',
  cerrado: 'bg-slate-200 text-slate-600',
};

// Tarjeta de un bulto en el historial de auditoría, con acciones de edición y borrado.
export default function BultoAuditCard({ bulto: b, stateName, sinEstadoLabel, canDelete, onEdit, onDelete }) {
  const status = STATUS_LABEL[b.status] ? b.status : 'activo';

  return (
    <Card className="border border-slate-100 bg-slate-50/60 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-800 font-mono text-sm">{b.label_code}</h3>
              <Badge className={STATUS_CLASS[status] || 'bg-blue-100 text-blue-700'}>
                {STATUS_LABEL[status] || 'Activo'}
              </Badge>
              {b.bulto_number > 0 && (
                <Badge variant="outline" className="border-slate-200 text-slate-600">
                  Bulto {b.bulto_number}/{b.total_bultos || b.bulto_number}
                </Badge>
              )}
              {Array.isArray(b.cbm_order_numbers) && b.cbm_order_numbers.length > 0 && (
                <Badge className="bg-blue-100 text-blue-700 gap-1">
                  <Hash className="h-3 w-3" /> {b.cbm_order_numbers.join(', ')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(b.created_date).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0 lg:items-end">
            <div className="text-sm text-slate-600 lg:text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">Procesado por</p>
              <p className="font-medium break-all">{b.created_by || '—'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="gap-1.5 text-red-600 hover:bg-red-50 hover:border-red-200"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-lg bg-white p-2.5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Cliente</p>
            <p className="mt-0.5 text-sm text-slate-700 break-all">{b.client_email || '—'}</p>
            <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-slate-500">
              <MapPin className="h-3 w-3" /> {stateName || sinEstadoLabel}
            </span>
          </div>
          <div className="rounded-lg bg-white p-2.5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Shipping Mark</p>
            <p className="mt-0.5 text-sm text-slate-700 font-mono">{b.shipping_mark || '—'}</p>
          </div>
          <div className="rounded-lg bg-white p-2.5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Paquetes ({b.package_ids?.length || 0})</p>
            <p className="mt-0.5 text-xs text-slate-600 break-all">
              {(b.package_trackings || []).slice(0, 3).join(', ')}
              {(b.package_trackings || []).length > 3 && ` +${b.package_trackings.length - 3} más`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}