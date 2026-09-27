import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Package, Truck, AlertTriangle } from 'lucide-react';

const money = (v) => `$${Number(v || 0).toFixed(2)}`;

export default function WarehouseBillingItemRow({ item, amount, checked, onToggle }) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
        checked ? 'border-primary/50 bg-accent/60' : 'border-border/70 hover:border-border'
      }`}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <span className="font-semibold text-slate-800 break-all">
            {item.type === 'bulto' ? `Bulto ${item.label}` : `Envío ${item.label}`}
          </span>
          <span className="font-semibold text-primary shrink-0">{money(amount)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            {item.type === 'bulto' ? <Package className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
            {Number(item.cbm || 0).toFixed(4)} CBM
          </span>
          <span className="text-slate-400">·</span>
          <span>{item.package_count || 0} paquete(s)</span>
          {item.order_numbers?.length > 0 && (
            <>
              <span className="text-slate-400">·</span>
              <span className="font-mono">Orden {item.order_numbers.join(', ')}</span>
            </>
          )}
          {item.fecha && (
            <>
              <span className="text-slate-400">·</span>
              <span>{new Date(item.fecha).toLocaleDateString('es-VE')}</span>
            </>
          )}
        </div>

        {(item.type === 'bulto' && !item.order_numbers?.length) && (
          <Badge className="mt-2 mr-1 bg-amber-100 text-amber-700 border border-amber-200">Sin N° de orden</Badge>
        )}
        {Number(item.cbm || 0) <= 0 && (
          <Badge className="mt-2 mr-1 bg-slate-100 text-slate-600 border border-slate-200">Sin CBM registrado</Badge>
        )}
        {item.overlap_bulto && (
          <Badge className="mt-2 bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Ya incluido en un bulto en almacén
          </Badge>
        )}

        {item.trackings?.length > 0 && (
          <p className="mt-2 text-xs text-slate-500 break-all line-clamp-2">{item.trackings.join(', ')}</p>
        )}
      </div>
    </label>
  );
}