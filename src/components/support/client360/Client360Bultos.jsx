import React from 'react';
import { Boxes } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Client360Section from './Client360Section';

const STATUS = {
  activo: { label: 'Abierto', cls: 'bg-amber-100 text-amber-700' },
  cerrado: { label: 'Cerrado', cls: 'bg-blue-100 text-blue-700' },
  en_almacen_ve: { label: 'En almacén VE', cls: 'bg-cyan-100 text-cyan-700' },
  despachado: { label: 'Despachado', cls: 'bg-emerald-100 text-emerald-700' },
};

const fdate = (value) => (value ? new Date(value).toLocaleDateString('es-VE') : '');

// Bultos y cajas consolidadas del cliente: qué etiqueta tiene cada uno, cuántos
// paquetes lleva, su CBM y en qué punto va.
export default function Client360Bultos({ bultos = [] }) {
  return (
    <Client360Section icon={Boxes} title="Bultos y cajas" count={bultos.length}>
      {bultos.map((bulto) => {
        const packages = bulto.cargo_package_count ?? (bulto.package_ids || []).length;
        return (
          <div key={bulto.id} className="flex items-center gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-slate-800 truncate">{bulto.label_code}</p>
              <p className="text-xs text-slate-500 truncate">
                {bulto.is_caja
                  ? `Caja ${bulto.caja_number || 1}/${bulto.caja_total || 1}`
                  : `Bulto ${bulto.bulto_number || 1}/${bulto.total_bultos || 1}`}
                {packages ? ` · ${packages} paquete(s)` : ''}
                {(bulto.cbm_order_numbers || []).length ? ` · ${bulto.cbm_order_numbers.join(', ')}` : ''}
                {bulto.ve_recognized_date ? ` · reconocido ${fdate(bulto.ve_recognized_date)}` : ''}
              </p>
            </div>
            {bulto.cargo_cbm ? (
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                {Number(bulto.cargo_cbm).toFixed(4)} CBM
              </span>
            ) : null}
            <Badge className={`text-[10px] ${STATUS[bulto.status]?.cls || 'bg-slate-100 text-slate-600'}`}>
              {STATUS[bulto.status]?.label || bulto.status}
            </Badge>
          </div>
        );
      })}
    </Client360Section>
  );
}