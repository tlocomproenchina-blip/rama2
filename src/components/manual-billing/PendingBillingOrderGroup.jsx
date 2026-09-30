import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Boxes, FileText, Package } from 'lucide-react';
import PendingBillingBultoRow from './PendingBillingBultoRow';

const fmtDate = (v) => {
  if (!v) return null;
  const d = new Date(String(v).includes('T') ? v : `${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-VE');
};

// Pestaña de un N° de orden/envío: el número a la cabeza y, adentro, todos los bultos
// que le corresponden. Se factura y se despacha junto, así que se trabaja en un solo lugar.
// Los recibos de ese mismo envío se muestran como referencia, sin casilla de marcado.
export default function PendingBillingOrderGroup({ group, markingId, onMarkBulto }) {
  const { order, bultos = [], receipts = [] } = group;
  const unassigned = !order;
  const packages = bultos.reduce((sum, item) => sum + Number(item.bulto.package_count || 0), 0);
  const cbm = bultos.reduce((sum, item) => sum + Number(item.bulto.cbm || 0), 0);

  return (
    <div className={`rounded-lg border p-2 ${unassigned ? 'border-amber-200 bg-amber-50/50' : 'border-border/70 bg-muted/40'}`}>
      <p className={`font-mono text-sm font-bold break-all ${unassigned ? 'text-amber-700' : 'text-blue-700'}`}>
        {unassigned ? 'Sin N° de orden' : order}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {bultos.length > 0 && (
          <>
            <Badge variant="secondary" className="inline-flex items-center gap-1">
              <Boxes className="h-3 w-3" /> {bultos.length} bulto(s)
            </Badge>
            <Badge variant="secondary" className="inline-flex items-center gap-1">
              <Package className="h-3 w-3" /> {packages} paquete(s)
            </Badge>
            <Badge variant="secondary">{cbm.toFixed(4)} CBM</Badge>
          </>
        )}
        {receipts.length > 0 && (
          <Badge variant="secondary" className="inline-flex items-center gap-1">
            <FileText className="h-3 w-3" /> {receipts.length} envío(s)
          </Badge>
        )}
      </div>

      {bultos.length > 0 && (
        <div className="mt-2 space-y-2">
          {bultos.map(({ bulto, shared }) => (
            <div key={bulto.id}>
              <PendingBillingBultoRow
                bulto={bulto}
                marking={markingId === bulto.id}
                onMark={onMarkBulto}
              />
              {shared && (
                <p className="mt-0.5 text-[10px] text-slate-500">También pertenece a otro N° de orden</p>
              )}
            </div>
          ))}
        </div>
      )}

      {receipts.length > 0 && (
        <div className="mt-2 space-y-1 rounded-md bg-card/80 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Recibo de este envío (referencia)
          </p>
          {receipts.map((r) => (
            <p key={r.id} className="text-[11px] text-slate-600 break-all">
              <span className="font-mono font-semibold text-slate-800">{r.label}</span>
              {' · '}{Number(r.cbm || 0).toFixed(4)} CBM · {r.package_count || 0} paquete(s)
              {fmtDate(r.fecha) ? ` · ${fmtDate(r.fecha)}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}