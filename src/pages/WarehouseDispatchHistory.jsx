import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, History, Search, GitMerge, X } from 'lucide-react';
import { toast } from 'sonner';
import DispatchOrderCard from '@/components/warehouse/DispatchOrderCard';
import DispatchOrderEditModal from '@/components/warehouse/DispatchOrderEditModal';
import { generateDispatchOrderPdf } from '@/lib/dispatchOrderPdf';

export default function WarehouseDispatchHistory({ user }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editOrder, setEditOrder] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [merging, setMerging] = useState(false);
  const [orderTotalsMap, setOrderTotalsMap] = useState({});

  // Consulta los totales esperados por recibo desde CbmIngreso (AdminCbmIngresos)
  // y construye un mapa { orderId: { receipt: total_expected } }.
  const enrichReceiptTotals = useCallback(async (ordersList) => {
    if (!ordersList.length) { setOrderTotalsMap({}); return; }
    // Agrupar recibos por client_email para minimizar llamadas
    const byClient = {};
    ordersList.forEach((o) => {
      const email = (o.client_email || '').trim();
      if (!email) return;
      const receipts = (o.items || [])
        .map((i) => String(i.consolidation_tracking || '').trim())
        .filter((r) => r && r !== 'Sin recibo');
      if (!receipts.length) return;
      if (!byClient[email]) byClient[email] = new Set();
      receipts.forEach((r) => byClient[email].add(r));
    });

    const clientTotals = {}; // { email: { receipt: total } }
    const entries = Object.entries(byClient);
    await Promise.all(entries.map(async ([email, receiptSet]) => {
      try {
        const res = await base44.functions.invoke('getDispatchReceiptTotals', {
          receipts: Array.from(receiptSet),
          client_email: email
        });
        clientTotals[email] = res?.data?.totals || res?.totals || {};
      } catch (_) { clientTotals[email] = {}; }
    }));

    const map = {};
    ordersList.forEach((o) => {
      const email = (o.client_email || '').trim();
      const t = clientTotals[email] || {};
      // Solo incluir recibos presentes en esta orden
      const orderMap = {};
      (o.items || []).forEach((i) => {
        const r = String(i.consolidation_tracking || '').trim();
        if (r && r !== 'Sin recibo' && t[r] != null) orderMap[r] = t[r];
      });
      map[o.id] = orderMap;
    });
    setOrderTotalsMap(map);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.DispatchOrder.list('-created_date', 100);
      const ordersList = rows || [];

      // Enriquecer items con consolidation_tracking (recibo) si no lo tienen
      const trackingsToLookup = [];
      ordersList.forEach((o) => {
        (o.items || []).forEach((item) => {
          if (item.tracking_number && !item.consolidation_tracking) {
            trackingsToLookup.push(item.tracking_number);
          }
        });
      });

      if (trackingsToLookup.length > 0) {
        try {
          const res = await base44.functions.invoke('getDispatchReceiptsMap', { tracking_numbers: trackingsToLookup });
          const receiptMap = res?.data?.map || res?.map || {};
          // Inyectar consolidation_tracking en los items que no lo tienen
          ordersList.forEach((o) => {
            if (!Array.isArray(o.items)) return;
            o.items = o.items.map((item) => {
              if (item.consolidation_tracking) return item;
              const receipt = receiptMap[item.tracking_number] || '';
              return { ...item, consolidation_tracking: receipt };
            });
          });
        } catch (_) {}
      }

      setOrders(ordersList);
      // Cargar totales esperados por recibo en segundo plano (no bloquea el render)
      enrichReceiptTotals(ordersList);
    } catch (e) {
      toast.error('No se pudo cargar el historial');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Suscripción en tiempo real: actualiza la lista cuando cambian órdenes de despacho
  useEffect(() => {
    let timer = null;
    const scheduleReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { load(); }, 400);
    };
    const unsubscribe = base44.entities.DispatchOrder.subscribe((event) => {
      if (!event || !event.type) return;
      if (event.type === 'create' && event.data) {
        setOrders((prev) => {
          if (prev.some((o) => o.id === event.data.id)) return prev;
          return [event.data, ...prev];
        });
        scheduleReload(); // enriquecer consolidation_tracking en segundo plano
      } else if (event.type === 'update' && event.data) {
        setOrders((prev) => prev.map((o) => (o.id === event.data.id ? { ...o, ...event.data } : o)));
      } else if (event.type === 'delete' && event.id) {
        setOrders((prev) => prev.filter((o) => o.id !== event.id));
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [load]);

  const buildPdf = async (order, mode) => {
    const configs = await base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1).catch(() => []);
    let enrichedOrder = order;
    const needsLookup = (order.items || []).some((i) => i.tracking_number && !i.consolidation_tracking);
    if (needsLookup) {
      try {
        const trackings = (order.items || []).map((i) => i.tracking_number).filter(Boolean);
        const res = await base44.functions.invoke('getDispatchReceiptsMap', { tracking_numbers: trackings });
        const receiptMap = res?.data?.map || res?.map || {};
        enrichedOrder = {
          ...order,
          items: (order.items || []).map((item) => ({
            ...item,
            consolidation_tracking: item.consolidation_tracking || receiptMap[item.tracking_number] || '',
          })),
        };
      } catch (_) {}
    }
    await generateDispatchOrderPdf(enrichedOrder, configs?.[0]?.app_name || 'TLEC CARGO', mode);
  };

  const handleDownload = (order) => buildPdf(order, 'save');
  const handlePrint = (order) => buildPdf(order, 'print');

  const handleSave = async (patch) => {
    setProcessing(true);
    try {
      await base44.entities.DispatchOrder.update(editOrder.id, patch);
      setOrders((prev) => prev.map((o) => (o.id === editOrder.id ? { ...o, ...patch } : o)));
      toast.success('Orden actualizada');
      setEditOrder(null);
    } catch (e) {
      toast.error('No se pudo actualizar la orden');
    }
    setProcessing(false);
  };

  const handleCancel = async (order) => {
    if (!window.confirm(`¿Cancelar la orden ${order.order_number}? Los paquetes volverán a estado "recibido".`)) return;
    try {
      const patch = { status: 'cancelada', cancelled_date: new Date().toISOString(), cancelled_by: user?.email || '' };
      await base44.entities.DispatchOrder.update(order.id, patch);

      for (const item of order.items || []) {
        const matches = await base44.entities.Package.filter({ tracking_number: item.tracking_number }).catch(() => []);
        const pkg = matches?.[0];
        if (pkg && pkg.status === 'despachado') {
          await base44.entities.Package.update(pkg.id, { status: 'recibido', dispatched_date: null, dispatched_by: null });
        }
      }

      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...patch } : o)));
      toast.success('Orden cancelada y paquetes revertidos a recibido');
    } catch (e) {
      toast.error('No se pudo cancelar la orden');
    }
  };

  const handleToggleDespachado = async (order) => {
    setTogglingId(order.id);
    try {
      const res = await base44.functions.invoke('markDispatchOrderDespachado', { order_id: order.id });
      const updated = res?.data?.order;
      if (!updated) throw new Error('No se pudo actualizar');
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updated } : o)));
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

  const handleDelete = async (order) => {
    if (!window.confirm(`¿Borrar definitivamente la orden ${order.order_number}?`)) return;
    try {
      await base44.entities.DispatchOrder.delete(order.id);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      toast.success('Orden eliminada');
    } catch (e) {
      toast.error('No se pudo eliminar la orden');
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = !q ? orders : orders.filter((o) =>
    (o.order_number || '').toLowerCase().includes(q) ||
    (o.client_email || '').toLowerCase().includes(q) ||
    (o.client_name || '').toLowerCase().includes(q) ||
    (o.shipping_mark || '').toLowerCase().includes(q) ||
    (o.items || []).some((i) => (i.tracking_number || '').toLowerCase().includes(q))
  );

  // Solo se pueden fusionar órdenes "emitida" del mismo cliente
  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.includes(o.id)),
    [orders, selectedIds]
  );
  const canMerge = useMemo(() => {
    if (selectedOrders.length < 2) return false;
    const email = selectedOrders[0].client_email;
    return selectedOrders.every((o) => o.client_email === email && o.status === 'emitida');
  }, [selectedOrders]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleMerge = async () => {
    if (!canMerge) return;
    setMerging(true);
    try {
      const res = await base44.functions.invoke('mergeDispatchOrders', { order_ids: selectedIds });
      const merged = res?.data?.merged || 0;
      const added = res?.data?.added || 0;
      toast.success(`${merged + 1} órdenes fusionadas en una sola (+${added} paquetes)`);
      setSelectedIds([]);
      setSelectMode(false);
      await load();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudo fusionar';
      toast.error(msg);
    }
    setMerging(false);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <History className="h-6 w-6 text-blue-600" /> Historial de Despachos
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Consulta, modifica, cancela o elimina órdenes de despacho y descarga su PDF.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por orden, cliente, mark o tracking"
            className="pl-10"
          />
        </div>
        <Button
          variant={selectMode ? "default" : "outline"}
          onClick={() => { setSelectMode(!selectMode); setSelectedIds([]); }}
          className="shrink-0"
        >
          <GitMerge className="h-4 w-4" />
          {selectMode ? 'Cancelar selección' : 'Seleccionar'}
        </Button>
      </div>

      {selectMode && (
        <div className="flex items-center justify-between gap-2 flex-wrap rounded-xl border border-blue-200 bg-blue-50/60 p-3">
          <p className="text-sm text-slate-600">
            {selectedIds.length === 0
              ? 'Selecciona 2 o más órdenes del mismo cliente (solo "emitida") para fusionarlas.'
              : `${selectedIds.length} seleccionada${selectedIds.length !== 1 ? 's' : ''}`}
            {selectedIds.length >= 2 && !canMerge && (
              <span className="text-amber-600 font-medium ml-1">— Deben ser del mismo cliente y estar "emitida"</span>
            )}
          </p>
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                <X className="h-4 w-4" /> Limpiar
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleMerge}
              disabled={!canMerge || merging}
            >
              {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
              Fusionar ({selectedIds.length})
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-10">No hay órdenes de despacho registradas.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <DispatchOrderCard
              key={order.id}
              order={order}
              liveReceiptTotals={orderTotalsMap[order.id] || {}}
              onEdit={setEditOrder}
              onDelete={handleDelete}
              onCancel={handleCancel}
              onDownload={handleDownload}
              onPrint={handlePrint}
              onToggleDespachado={handleToggleDespachado}
              togglingDespachado={togglingId === order.id}
              selectable={selectMode && order.status === 'emitida'}
              selected={selectedIds.includes(order.id)}
              onSelectToggle={toggleSelect}
            />
          ))}
        </div>
      )}

      <DispatchOrderEditModal
        order={editOrder}
        processing={processing}
        onClose={() => setEditOrder(null)}
        onSave={handleSave}
      />
    </div>
  );
}