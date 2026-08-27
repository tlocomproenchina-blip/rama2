import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Truck, Package, CheckCircle2, Lock } from 'lucide-react';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Selector de órdenes de despacho disponibles para pagar dentro de una factura manual.
// Recibe la factura y notifica al padre el total a abonar y los ids seleccionados.
export default function DispatchOrderSelector({ invoice, onChange }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!invoice?.id) return;
      setLoading(true);
      try {
        const res = await base44.functions.invoke('getInvoiceDispatchOrders', { invoice_id: invoice.id });
        const data = res?.data || res;
        const list = Array.isArray(data?.orders) ? data.orders : [];
        if (cancelled) return;
        setOrders(list);
        // Pre-seleccionar ninguna; el cliente elige
        const init = {};
        list.forEach((o) => { init[o.order_id] = false; });
        setSelected(init);
      } catch (e) {
        console.error('Error loading dispatch orders', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [invoice?.id]);

  const available = orders.filter((o) => !o.paid && o.status !== 'cancelada');
  const paid = orders.filter((o) => o.paid);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const selectedIds = available.filter((o) => next[o.order_id]).map((o) => o.order_id);
      const totalAmount = available.filter((o) => next[o.order_id]).reduce((s, o) => s + num(o.amount), 0);
      onChange?.({ selectedIds, totalAmount: Math.round(totalAmount * 100) / 100 });
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium flex items-center gap-2"><Truck className="h-4 w-4" /> Sin órdenes de despacho disponibles</p>
        <p className="text-xs mt-1 text-amber-700">
          Aún no se han creado órdenes de despacho para esta carga en el almacén. Vuelve más tarde cuando el almacén genere las órdenes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Truck className="h-4 w-4 text-blue-600" />
        Envíos / Recibos disponibles para pagar
      </div>
      <p className="text-xs text-slate-500">
        Selecciona los envíos que deseas pagar en este abono. El monto se calcula automáticamente.
      </p>

      <div className="space-y-2">
        {available.map((o) => (
          <label
            key={o.order_id}
            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
              selected[o.order_id] ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <Checkbox
              checked={!!selected[o.order_id]}
              onCheckedChange={() => toggle(o.order_id)}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-slate-800 break-all">
                  {`Envío ${o.recibos && o.recibos.length > 0 ? o.recibos.join(', ') : o.order_number}`}
                </span>
                <span className="font-bold text-blue-700 shrink-0">${num(o.amount).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 flex-wrap">
                <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" /> {num(o.cbm).toFixed(4)} CBM</span>
                <span className="text-slate-400">·</span>
                <span>{o.tracking_numbers?.length || 0} tracking(s)</span>
              </div>
              {selected[o.order_id] && o.breakdown && (
                <div className="mt-2 rounded-lg bg-white/70 border border-blue-100 px-2.5 py-1.5 space-y-0.5">
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Envío</span><span>${num(o.breakdown.shipping).toFixed(2)}</span>
                  </div>
                  {num(o.breakdown.consolidation) > 0 && (
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Consolidación</span><span>${num(o.breakdown.consolidation).toFixed(2)}</span>
                    </div>
                  )}
                  {num(o.breakdown.insurance) > 0 && (
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Seguro</span><span>${num(o.breakdown.insurance).toFixed(2)}</span>
                    </div>
                  )}
                  {num(o.breakdown.door_to_door) > 0 && (
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Puerta a puerta</span><span>${num(o.breakdown.door_to_door).toFixed(2)}</span>
                    </div>
                  )}
                  {num(o.breakdown.extra) > 0 && (
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>Extra</span><span>${num(o.breakdown.extra).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
              {o.tracking_numbers?.length > 0 && !selected[o.order_id] && (
                <p className="text-xs text-slate-500 mt-1 break-all line-clamp-2">
                  {o.tracking_numbers.join(', ')}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>

      {paid.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t">
          <p className="text-xs font-medium text-emerald-700 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> Envíos ya pagados ({paid.length})
          </p>
          {paid.map((o) => (
          <div key={o.order_id} className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
            <div className="min-w-0">
              <span className="font-semibold text-slate-700 text-sm break-all">{`Envío ${o.recibos && o.recibos.length > 0 ? o.recibos.join(', ') : o.order_number}`}</span>
              <span className="text-xs text-slate-500 ml-2 inline-flex items-center gap-1"><Lock className="h-3 w-3" /> pagado</span>
            </div>
              <span className="text-sm font-medium text-emerald-700 shrink-0">${num(o.amount).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}