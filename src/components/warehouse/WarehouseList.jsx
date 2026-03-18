import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, MapPin } from 'lucide-react';

export default function WarehouseList({ warehouses, onEdit, onDelete, pendingIds = {}, failedIds = {}, pendingDeleteIds = {} }) {
  if (!warehouses.length) {
    return <Card className="shadow-sm"><CardContent className="p-8 text-center text-slate-500">No hay almacenes registrados.</CardContent></Card>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {warehouses.map((warehouse) => (
        <Card
          key={warehouse.id}
          className={`shadow-sm transition-all ${pendingIds[warehouse.id] ? 'opacity-70' : ''} ${pendingDeleteIds[warehouse.id] ? 'scale-[0.99] opacity-60' : ''} ${failedIds[warehouse.id] ? 'border-rose-200 bg-rose-50/40' : ''}`}
        >
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-800">{warehouse.name}</h3>
                <p className="text-sm text-slate-500 font-mono">{warehouse.code}</p>
              </div>
              <Badge variant="outline" className={warehouse.is_active === false ? 'text-rose-600 border-rose-200' : 'text-emerald-700 border-emerald-200'}>
                {warehouse.is_active === false ? 'Inactivo' : 'Activo'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span>{warehouse.city}, {warehouse.country}</span>
            </div>
            {warehouse.address && <p className="text-sm text-slate-500">{warehouse.address}</p>}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(warehouse)} disabled={pendingIds[warehouse.id] || pendingDeleteIds[warehouse.id]}>
                <Pencil className="h-4 w-4 mr-2" /> {pendingIds[warehouse.id] ? 'Guardando...' : 'Editar'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDelete(warehouse)} className="text-rose-600 border-rose-200 hover:text-rose-700" disabled={pendingIds[warehouse.id] || pendingDeleteIds[warehouse.id]}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}