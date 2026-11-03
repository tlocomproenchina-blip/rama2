import React, { useState } from 'react';
import { Truck, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { groupItemsByReceipt, buildTrackingToReceiptMap } from '@/lib/dispatchOrderGroups';
import Client360Section from './Client360Section';

export default function Client360DispatchOrders({ orders = [] }) {
  const [togglingId, setTogglingId] = useState(null);
  const [localOrders, setLocalOrders] = useState(orders);
  const [trackingToReceipt, setTrackingToReceipt] = useState({});

  React.useEffect(() => { setLocalOrders(orders); }, [orders]);

  // Cargar CbmIngreso por client_email de las órdenes para resolver el recibo
  // real de los items sin consolidation_tracking (consistencia con AdminManualBilling).
  React.useEffect(() => {
    const emails = [...new Set((orders || []).map((o) => (o.client_email || '').trim()).filter(Boolean))];
    if (!emails.length) { setTrackingToReceipt({}); return; }
    let cancelled = false;
    (async () => {
      try {
        const ingresos = await base44.entities.CbmIngreso.filter({ client_email: { $in: emails } }, '-fecha', 1000);
        if (!cancelled) setTrackingToReceipt(buildTrackingToReceiptMap(ingresos || []));
      } catch {
        if (!cancelled) setTrackingToReceipt({});
      }
    })();
    return () => { cancelled = true; };
  }, [orders]);

  const handleToggleDespachado = async (order) => {
    setTogglingId(order.id);
    try {
      const res = await base44.functions.invoke('markDispatchOrderDespachado', { order_id: order.id });
      const updated = res?.data?.order;
      if (!updated) throw new Error('No se pudo actualizar');
      setLocalOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updated } : o)));
      if (res?.data?.reverted) {
        toast.info(`Orden ${order.order_number} revertida a emitida`);
      } else {
        toast.success(`Orden ${order.order_number} marcada como despachada`);
      }
    } catch (e) {
      toast.error('No se pudo actualizar el estado de despacho');
    }
    setTogglingId(null);
  };

  return (
    <Client360Section icon={Truck} title="Órdenes de Despacho" count={localOrders.length}>
      {localOrders.map((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        const cancelled = order.status === 'cancelada';
        const despachado = order.status === 'despachado';
        const receiptGroups = groupItemsByReceipt(items, trackingToReceipt);

        return (
          <div key={order.id} className="px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-slate-800 truncate">{order.order_number || '—'}</p>
                <p className="text-xs text-slate-500 truncate">
                  {order.dispatched_date ? new Date(order.dispatched_date).toLocaleDateString('es-VE') : ''} · {items.length} paq.
                </p>
              </div>
              {cancelled ? (
                <Badge className="text-[10px] bg-rose-100 text-rose-700">Cancelada</Badge>
              ) : despachado ? (
                <Badge className="text-[10px] bg-blue-100 text-blue-700 flex items-center gap-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Despachada
                </Badge>
              ) : (
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700">Emitida</Badge>
              )}
            </div>

            {/* Casilla de despachado */}
            {!cancelled && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={despachado}
                  disabled={togglingId === order.id}
                  onChange={() => handleToggleDespachado(order)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`text-xs font-medium ${despachado ? 'text-blue-700' : 'text-slate-600'}`}>
                  {togglingId === order.id ? 'Procesando...' : despachado ? 'Despachado confirmado' : 'Marcar como despachado'}
                </span>
              </label>
            )}

            {/* Recibos agrupados (compacto) */}
            {receiptGroups.length > 0 && receiptGroups[0].receipt !== 'Sin recibo' && (
              <div className="flex flex-wrap gap-1 pl-5">
                {receiptGroups.map((g) => (
                  <span key={g.receipt} className="text-[10px] rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                    {g.receipt}: {g.count} paq.
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </Client360Section>
  );
}