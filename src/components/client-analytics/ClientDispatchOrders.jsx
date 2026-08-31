import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, ChevronDown, ChevronRight, Package as PackageIcon, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { groupItemsByReceipt, buildTrackingToReceiptMap } from '@/lib/dispatchOrderGroups';

export default function ClientDispatchOrders({ orders = [], client }) {
  const [expanded, setExpanded] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [localOrders, setLocalOrders] = useState(orders);
  const [receiptTotals, setReceiptTotals] = useState({});
  const [trackingToReceipt, setTrackingToReceipt] = useState({});

  // Sincronizar cuando cambian las órdenes entrantes
  React.useEffect(() => { setLocalOrders(orders); }, [orders]);

  const sorted = useMemo(
    () => [...localOrders].sort((a, b) => new Date(b.dispatched_date || b.created_date) - new Date(a.dispatched_date || a.created_date)),
    [localOrders]
  );

  // Fetch expected totals per receipt to calculate missing packages
  React.useEffect(() => {
    const allReceipts = new Set();
    sorted.forEach((order) => {
      const items = Array.isArray(order.items) ? order.items : [];
      items.forEach((item) => {
        const r = (item?.consolidation_tracking || '').trim();
        if (r) allReceipts.add(r);
      });
    });
    const receipts = Array.from(allReceipts);
    if (receipts.length === 0 || !client?.email) {
      setReceiptTotals({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('getDispatchReceiptTotals', {
          receipts,
          client_email: client.email
        });
        if (!cancelled) setReceiptTotals(res?.data?.totals || {});
      } catch {
        if (!cancelled) setReceiptTotals({});
      }
    })();
    return () => { cancelled = true; };
  }, [sorted, client?.email]);

  // Cargar CbmIngreso del cliente para resolver el recibo real de los items
  // que no tienen consolidation_tracking (consistencia con AdminManualBilling).
  React.useEffect(() => {
    if (!client?.email) { setTrackingToReceipt({}); return; }
    let cancelled = false;
    (async () => {
      try {
        const ingresos = await base44.entities.CbmIngreso.filter({ client_email: client.email }, '-fecha', 500);
        if (!cancelled) setTrackingToReceipt(buildTrackingToReceiptMap(ingresos || []));
      } catch {
        if (!cancelled) setTrackingToReceipt({});
      }
    })();
    return () => { cancelled = true; };
  }, [client?.email]);

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
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <Truck className="h-5 w-5 text-blue-600" /> Órdenes de Despacho
          <span className="text-sm font-normal text-slate-400">({sorted.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-slate-500">No hay órdenes de despacho registradas para este cliente.</p>
        ) : (
          sorted.map((order) => {
            const isOpen = expanded === order.id;
            const items = Array.isArray(order.items) ? order.items : [];
            const cancelled = order.status === 'cancelada';
            const despachado = order.status === 'despachado';
            const receiptGroups = groupItemsByReceipt(items, trackingToReceipt);

            // Calcular total de paquetes faltantes en la orden
            const missingTotal = receiptGroups.reduce((sum, g) => {
              if (g.receipt === 'Sin recibo') return sum;
              const expected = receiptTotals[g.receipt] || 0;
              return sum + Math.max(0, expected - g.count);
            }, 0);

            const statusBadge = cancelled
              ? <Badge className="bg-rose-600 text-white">Cancelada</Badge>
              : despachado
                ? <Badge className="bg-blue-600 text-white flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Despachada</Badge>
                : <Badge className="bg-emerald-600 text-white">Emitida</Badge>;

            return (
              <div key={order.id} className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-slate-800 truncate">{order.order_number || '—'}</p>
                      <p className="text-sm text-slate-700 truncate">{order.client_name || order.client_email}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {order.shipping_mark ? `${order.shipping_mark} · ` : ''}
                        {order.dispatched_date ? new Date(order.dispatched_date).toLocaleString('es-VE') : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {statusBadge}
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <PackageIcon className="h-3.5 w-3.5" /> {items.length}
                    </span>
                    {missingTotal > 0 && !despachado && (
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px]">
                        {missingTotal} faltante{missingTotal !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
                    {/* Casilla de despachado */}
                    {!cancelled && (
                      <label className="flex items-center gap-2 cursor-pointer select-none py-1">
                        <input
                          type="checkbox"
                          checked={despachado}
                          disabled={togglingId === order.id}
                          onChange={() => handleToggleDespachado(order)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-sm font-medium ${despachado ? 'text-blue-700' : 'text-slate-600'}`}>
                          {togglingId === order.id ? 'Procesando...' : despachado ? 'Despachado confirmado' : 'Marcar como despachado'}
                        </span>
                      </label>
                    )}

                    {/* Agrupación por recibo */}
                    <div className="space-y-2">
                      {receiptGroups.map((group) => {
                        const expected = group.receipt !== 'Sin recibo' ? (receiptTotals[group.receipt] || 0) : 0;
                        const missing = expected > 0 ? Math.max(0, expected - group.count) : 0;
                        return (
                        <div key={group.receipt} className="rounded-lg border border-slate-200 bg-white p-2">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-700">
                              {group.receipt !== 'Sin recibo' ? `Recibo ${group.receipt}` : group.receipt}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {group.count} paquete{group.count !== 1 ? 's' : ''}
                            </Badge>
                            {missing > 0 && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border border-amber-200">
                                {missing} faltante{missing !== 1 ? 's' : ''} de {expected}
                              </Badge>
                            )}
                          </div>
                          <ul className="space-y-0.5 pl-5">
                            {group.items.map((item, idx) => (
                              <li key={idx} className="text-xs font-mono text-slate-600 break-all">
                                {item.tracking_number}
                              </li>
                            ))}
                          </ul>
                        </div>
                        );
                      })}
                    </div>

                    {order.notes && (
                      <p className="text-xs text-slate-500 break-words">{order.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}