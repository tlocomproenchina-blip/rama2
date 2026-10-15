import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Package, Tag } from 'lucide-react';
import { format } from 'date-fns';

const BULTO_STATUS = {
  activo: { label: 'Activo', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  cerrado: { label: 'Cerrado', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  en_almacen_ve: { label: 'En almacén VE', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  despachado: { label: 'Despachado', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const PKG_STATUS = {
  pre_alerta: 'Pre-alerta',
  recibido: 'Recibido',
  consolidado: 'Consolidado',
  en_transito: 'En tránsito',
  disponible: 'Disponible',
  despachado: 'Despachado',
  entregado: 'Entregado',
  sin_cliente: 'Sin cliente',
  rechazado: 'Rechazado',
};

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-xs text-slate-700 break-words">{value}</p>
    </div>
  );
}

export default function ClientBultoRow({ bulto, packages }) {
  const [open, setOpen] = useState(false);
  const status = BULTO_STATUS[bulto.status] || { label: bulto.status || '—', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  const unregistered = bulto.unregistered_codes || [];
  const cachedTrackings = bulto.package_trackings || [];
  const orders = bulto.cbm_order_numbers || [];
  const absorbed = bulto.absorbed_bultos || [];
  const count = bulto.cargo_package_count
    ?? ((bulto.package_ids?.length || 0) + unregistered.length);

  const label = bulto.is_caja
    ? `Caja consolidada${bulto.caja_number ? ` ${bulto.caja_number}/${bulto.caja_total || '?'}` : ''}`
    : 'Bulto';

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 p-3 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {open ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
            <p className="font-mono text-sm font-medium text-slate-800">{bulto.label_code}</p>
            <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">{label}</Badge>
            <Badge variant="outline" className={`text-xs ${status.cls}`}>{status.label}</Badge>
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
            {count} {count === 1 ? 'paquete' : 'paquetes'}
          </span>
        </button>

        {open && (
          <div className="px-3 pb-3 border-t border-slate-100 pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Info label="N° de contenedor" value={orders.length ? orders.join(' · ') : '—'} />
              <Info label="CBM" value={bulto.cargo_cbm ? `${bulto.cargo_cbm} CBM` : '—'} />
              <Info label="Creado" value={bulto.created_date ? format(new Date(bulto.created_date), 'dd/MM/yyyy HH:mm') : '—'} />
              <Info label="Almacén" value={bulto.warehouse_id || '—'} />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Tag className="h-3 w-3 text-slate-400" />
                {bulto.is_caja ? 'Contenido de la caja consolidada' : 'Contenido del bulto'} ({count})
              </p>
              {packages.length > 0 ? (
                <ul className="space-y-1">
                  {packages.map((pkg) => (
                    <li key={pkg.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-md px-2 py-1">
                      <span className="font-mono text-xs text-slate-700 break-all">{pkg.tracking_number}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {pkg.description && <span className="text-[11px] text-slate-500 truncate max-w-[140px]">{pkg.description}</span>}
                        <span className="text-[11px] text-slate-500">{PKG_STATUS[pkg.status] || pkg.status || '—'}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : cachedTrackings.length > 0 ? (
                <ul className="space-y-1">
                  {cachedTrackings.map((t) => (
                    <li key={t} className="font-mono text-xs text-slate-700 bg-slate-50 rounded-md px-2 py-1 break-all">{t}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Sin paquetes registrados.</p>
              )}
            </div>

            {unregistered.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Package className="h-3 w-3 text-slate-400" />
                  Códigos sin registrar ({unregistered.length})
                </p>
                <ul className="space-y-1">
                  {unregistered.map((code) => (
                    <li key={code} className="font-mono text-xs text-slate-700 bg-slate-50 rounded-md px-2 py-1 break-all">{code}</li>
                  ))}
                </ul>
              </div>
            )}

            {absorbed.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">Bultos absorbidos ({absorbed.length})</p>
                <ul className="space-y-1">
                  {absorbed.map((a, i) => (
                    <li key={`${a.label_code}-${i}`} className="text-xs text-slate-600 bg-slate-50 rounded-md px-2 py-1">
                      <span className="font-mono">{a.label_code || '—'}</span> · {a.package_count || 0} paquetes
                      {a.order_numbers?.length ? ` · ${a.order_numbers.join(' · ')}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}