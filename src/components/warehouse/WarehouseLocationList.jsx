import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

export default function WarehouseLocationList({ locations, onEdit, onDelete, pendingIds = {}, failedIds = {}, pendingDeleteIds = {} }) {
  if (!locations.length) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-10 text-center text-slate-500">No hay ubicaciones registradas.</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {locations.map((location) => (
        <Card
          key={location.id}
          className={`shadow-sm transition-all ${pendingIds[location.id] ? 'opacity-70' : ''} ${pendingDeleteIds[location.id] ? 'scale-[0.99] opacity-60' : ''} ${failedIds[location.id] ? 'border-rose-200 bg-rose-50/40' : ''}`}
        >
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-800">{location.name}</h3>
                <p className="text-sm text-slate-500 font-mono">{location.code}</p>
              </div>
              <Badge variant="outline" className={location.is_active === false ? 'text-rose-600 border-rose-200' : 'text-emerald-700 border-emerald-200'}>
                {location.is_active === false ? 'Inactiva' : 'Activa'}
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-500">{location.warehouse_name || 'Sin almacén'} · {location.warehouse_city || '—'}, {location.warehouse_country || '—'}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{location.zone}</Badge>
                <Badge variant="outline">{location.type}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm text-slate-600">
              <div>
                <p className="text-slate-400">Paquetes</p>
                <p className="font-medium">{location.current_units || 0} / {location.capacity_units ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-400">CBM</p>
                <p className="font-medium">{location.current_volume_cbm || 0} / {location.capacity_volume_cbm ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-400">Kg</p>
                <p className="font-medium">{location.current_weight_kg || 0} / {location.capacity_weight_kg ?? '—'}</p>
              </div>
            </div>

            {location.notes && <p className="text-sm text-slate-500">{location.notes}</p>}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(location)} className="flex-1" disabled={pendingIds[location.id] || pendingDeleteIds[location.id]}>
                <Pencil className="h-4 w-4 mr-2" /> {pendingIds[location.id] ? 'Guardando...' : 'Editar'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDelete(location)} className="text-rose-600 border-rose-200 hover:text-rose-700" disabled={pendingIds[location.id] || pendingDeleteIds[location.id]}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}