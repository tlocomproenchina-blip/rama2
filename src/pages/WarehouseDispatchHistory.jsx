import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Input } from '@/components/ui/input';
import { Loader2, History, Search } from 'lucide-react';
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.DispatchOrder.list('-created_date', 100);
      setOrders(rows || []);
    } catch (e) {
      toast.error('No se pudo cargar el historial');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (order) => {
    const configs = await base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1).catch(() => []);
    await generateDispatchOrderPdf(order, configs?.[0]?.app_name || 'TLEC CARGO');
  };

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por orden, cliente, mark o tracking"
          className="pl-10"
        />
      </div>

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
              onEdit={setEditOrder}
              onDelete={handleDelete}
              onCancel={handleCancel}
              onDownload={handleDownload}
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