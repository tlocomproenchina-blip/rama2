// Historial de órdenes de despacho: consulta, edición, cancelación, fusión y PDF
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, History, Search, GitMerge, X, UserRound, Filter, FileText, DollarSign, Copy } from 'lucide-react';
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
  const [invoiceInfoMap, setInvoiceInfoMap] = useState({});
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [dispatchFilter, setDispatchFilter] = useState('all');
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [paidFilter, setPaidFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employees, setEmployees] = useState([]);
  const [showDuplicateReceipts, setShowDuplicateReceipts] = useState(false);

  // El filtro por creador es exclusivo del administrador general
  const canFilterByCreator = user?.role === 'admin';

  // Cargar empleados del área de almacén para el filtro de creador
  useEffect(() => {
    if (!canFilterByCreator) return;
    (async () => {
      try {
        const res = await base44.functions.invoke('listAdmins', { limit: 1000 });
        const admins = res?.data?.admins || res?.admins || [];
        setEmployees(admins.filter((a) => a.custom_role === 'almacen'));
      } catch (_) {}
    })();
  }, [canFilterByCreator]);

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

  // Consulta las facturas asociadas a los recibos de cada orden de despacho.
  // Cruza el número de recibo (consolidation_tracking del item) con:
  //  1. CbmIngreso.invoice_number → billed_invoice_id → Invoice (facturas manuales)
  //  2. Invoice.consolidation_tracking directo (facturas de consolidación regular)
  const enrichInvoiceInfo = useCallback(async (ordersList) => {
    if (!ordersList.length) { setInvoiceInfoMap({}); return; }
    const emails = [...new Set(ordersList.map((o) => (o.client_email || '').trim()).filter(Boolean))];
    const ingresosByClient = {};
    const invoicesByClient = {};
    const paymentsByClient = {};

    // Una consulta por entidad para TODOS los clientes de la página, en lugar
    // de 3 consultas por cliente (que con 100 órdenes eran 300 peticiones).
    const groupByEmail = (rows, target) => {
      (rows || []).forEach((r) => {
        const email = (r.client_email || '').trim();
        if (!email) return;
        if (!target[email]) target[email] = [];
        target[email].push(r);
      });
    };

    try {
      const [ingresos, invoices, payments] = await Promise.all([
        base44.entities.CbmIngreso.filter({ client_email: { $in: emails } }, '-fecha', 2000),
        base44.entities.Invoice.filter({ client_email: { $in: emails } }, '-created_date', 2000),
        base44.entities.InvoicePayment.filter({ client_email: { $in: emails } }, '-created_date', 2000),
      ]);
      groupByEmail(ingresos, ingresosByClient);
      groupByEmail(invoices, invoicesByClient);
      groupByEmail(payments, paymentsByClient);
    } catch (_) {}

    const map = {};
    ordersList.forEach((o) => {
      const email = (o.client_email || '').trim();
      const receipts = (o.items || [])
        .map((i) => String(i.consolidation_tracking || '').trim())
        .filter((r) => r && r !== 'Sin recibo');
      const receiptSet = new Set(receipts);
      const clientIngresos = ingresosByClient[email] || [];
      const clientInvoices = invoicesByClient[email] || [];
      const clientPayments = paymentsByClient[email] || [];

      // 1) Puente via CbmIngreso: recibo → invoice_number → billed_invoice_id
      const matchedInvoiceIds = new Set();
      clientIngresos.forEach((ing) => {
        if (ing.invoice_number && receiptSet.has(String(ing.invoice_number).trim()) && ing.billed_invoice_id) {
          matchedInvoiceIds.add(ing.billed_invoice_id);
        }
      });

      // 2) Match directo: recibo → Invoice.consolidation_tracking
      const directMatches = clientInvoices.filter((inv) =>
        inv.consolidation_tracking && receiptSet.has(String(inv.consolidation_tracking).trim())
      );

      // Combinar resultados sin duplicar
      const seen = new Set();
      const matchedInvoices = [];
      clientInvoices.forEach((inv) => {
        if (matchedInvoiceIds.has(inv.id) && !seen.has(inv.id)) {
          seen.add(inv.id);
          matchedInvoices.push(inv);
        }
      });
      directMatches.forEach((inv) => {
        if (!seen.has(inv.id)) {
          seen.add(inv.id);
          matchedInvoices.push(inv);
        }
      });

      // 3) Verificar si existe un abono aprobado que incluya esta orden de
      //    despacho en su dispatch_order_ids → la orden está pagada aunque la
      //    factura completa no lo esté (pago parcial por envío)
      const orderPaidViaAbono = clientPayments.some(
        (p) => p.status === 'aprobado' &&
          Array.isArray(p.dispatch_order_ids) &&
          p.dispatch_order_ids.includes(o.id)
      );

      map[o.id] = {
        hasInvoice: matchedInvoices.length > 0 || orderPaidViaAbono,
        isPaid: orderPaidViaAbono || matchedInvoices.some((inv) => inv.status === 'pagada'),
        invoices: matchedInvoices.map((inv) => ({
          number: inv.invoice_number,
          status: inv.status,
          total: inv.total,
        })),
      };
    });
    setInvoiceInfoMap(map);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.DispatchOrder.list('-created_date', 100);
      const ordersList = rows || [];

      // La lista se muestra de inmediato; todo lo demás se completa después.
      setOrders(ordersList);
      setLoading(false);

      // Enriquecer items con consolidation_tracking (recibo) si no lo tienen
      const trackingsToLookup = [];
      ordersList.forEach((o) => {
        (o.items || []).forEach((item) => {
          if (item.tracking_number && !item.consolidation_tracking) {
            trackingsToLookup.push(item.tracking_number);
          }
        });
      });

      let enrichedList = ordersList;
      if (trackingsToLookup.length > 0) {
        try {
          const res = await base44.functions.invoke('getDispatchReceiptsMap', { tracking_numbers: trackingsToLookup });
          const receiptMap = res?.data?.map || res?.map || {};
          // Inyectar consolidation_tracking en los items que no lo tienen
          enrichedList = ordersList.map((o) => {
            if (!Array.isArray(o.items)) return o;
            return {
              ...o,
              items: o.items.map((item) => (
                item.consolidation_tracking
                  ? item
                  : { ...item, consolidation_tracking: receiptMap[item.tracking_number] || '' }
              )),
            };
          });
          setOrders(enrichedList);
        } catch (_) {}
      }

      // Totales esperados por recibo e info de facturación/pago
      enrichReceiptTotals(enrichedList);
      enrichInvoiceInfo(enrichedList);
    } catch (e) {
      toast.error('No se pudo cargar el historial');
      setLoading(false);
    }
  }, [enrichReceiptTotals, enrichInvoiceInfo]);

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

  // Opciones del filtro: empleados de almacén + otros creadores presentes en las órdenes
  const creatorOptions = useMemo(() => {
    const map = new Map();
    employees.forEach((e) => map.set((e.email || '').toLowerCase(), e.full_name || e.email));
    orders.forEach((o) => {
      const email = (o.created_by_email || '').trim().toLowerCase();
      if (email && !map.has(email)) map.set(email, email);
    });
    return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
  }, [employees, orders]);

  // IDs de órdenes "emitida" que comparten al menos un recibo con otra orden
  // "emitida" del mismo cliente → candidatas a fusión
  const duplicateReceiptOrderIds = useMemo(() => {
    const candidates = orders.filter((o) => o.status === 'emitida');
    const map = {};
    candidates.forEach((o) => {
      const email = (o.client_email || '').trim().toLowerCase();
      const receipts = (o.items || [])
        .map((i) => String(i.consolidation_tracking || '').trim())
        .filter((r) => r && r !== 'Sin recibo');
      receipts.forEach((r) => {
        const key = `${email}|||${r}`;
        if (!map[key]) map[key] = new Set();
        map[key].add(o.id);
      });
    });
    const dupIds = new Set();
    Object.values(map).forEach((idSet) => {
      if (idSet.size >= 2) idSet.forEach((id) => dupIds.add(id));
    });
    return dupIds;
  }, [orders]);

  const q = search.trim().toLowerCase();
  const byCreator = (!canFilterByCreator || creatorFilter === 'all')
    ? orders
    : orders.filter((o) => (o.created_by_email || '').trim().toLowerCase() === creatorFilter);
  const byDispatch = dispatchFilter === 'all'
    ? byCreator
    : dispatchFilter === 'despachado'
      ? byCreator.filter((o) => o.status === 'despachado')
      : byCreator.filter((o) => o.status !== 'despachado');

  const byInvoice = invoiceFilter === 'all'
    ? byDispatch
    : invoiceFilter === 'issued'
      ? byDispatch.filter((o) => invoiceInfoMap[o.id]?.hasInvoice)
      : invoiceFilter === 'paid'
        ? byDispatch.filter((o) => invoiceInfoMap[o.id]?.hasInvoice && invoiceInfoMap[o.id]?.isPaid)
        : byDispatch.filter((o) => !invoiceInfoMap[o.id]?.hasInvoice);

  const byPaid = paidFilter === 'all'
    ? byInvoice
    : paidFilter === 'paid'
      ? byInvoice.filter((o) => invoiceInfoMap[o.id]?.isPaid)
      : byInvoice.filter((o) => invoiceInfoMap[o.id] && !invoiceInfoMap[o.id].isPaid);

  const byDate = byPaid.filter((o) => {
    if (!dateFrom && !dateTo) return true;
    const raw = o.dispatched_date || o.created_date;
    if (!raw) return false;
    const day = new Date(raw).toISOString().slice(0, 10);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  });

  const byDup = showDuplicateReceipts
    ? byDate.filter((o) => duplicateReceiptOrderIds.has(o.id))
    : byDate;

  const filtered = !q ? byDup : byDup.filter((o) =>
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

  const handleCopyAll = () => {
    if (!filtered.length) { toast.error('No hay órdenes para copiar'); return; }
    const blocks = filtered.map((o) => {
      const snap = o.client_snapshot || {};
      const info = invoiceInfoMap[o.id];
      const invoiceStatus = !info?.hasInvoice
        ? 'Sin Factura'
        : info.isPaid
          ? 'Factura Pagada'
          : 'Factura No Pagada';
      const dispatchStatus = o.status === 'despachado'
        ? 'Despachada'
        : o.status === 'cancelada'
          ? 'Cancelada'
          : 'No Despachada';
      const receipts = [...new Set(
        (o.items || [])
          .map((i) => String(i.consolidation_tracking || '').trim())
          .filter((r) => r && r !== 'Sin recibo')
      )];
      return [
        `${invoiceStatus} / ${dispatchStatus}`,
        `Orden: ${o.order_number || ''}`,
        `Shipping Mark: ${o.shipping_mark || snap.shipping_mark || ''}`,
        `Nombre: ${snap.full_name || o.client_name || ''}`,
        `Ciudad: ${snap.city || ''}`,
        `Dirección: ${snap.address || ''}`,
        `Contacto: ${snap.whatsapp || ''}`,
        receipts.length ? `Recibos: ${receipts.join(', ')}` : '',
      ].filter(Boolean).join('\n');
    });
    const text = blocks.join('\n---\n\n');
    navigator.clipboard?.writeText(text).then(
      () => toast.success(`Información de ${filtered.length} orden(es) copiada`),
      () => toast.error('No se pudo copiar')
    );
  };

  const handleCopyWithoutInvoice = () => {
    const withoutInvoice = filtered.filter((o) => !invoiceInfoMap[o.id]?.hasInvoice);
    if (!withoutInvoice.length) { toast.info('No hay órdenes sin factura'); return; }
    const blocks = withoutInvoice.map((o) => {
      const snap = o.client_snapshot || {};
      const items = o.items || [];
      const sinRecibo = items.filter((i) => !String(i.consolidation_tracking || '').trim() || String(i.consolidation_tracking).trim() === 'Sin recibo');
      const lines = [
        `Orden: ${o.order_number || ''}`,
        `Shipping Mark: ${o.shipping_mark || snap.shipping_mark || ''}`,
        `Cliente: ${snap.full_name || o.client_name || ''}`,
      ];
      if (sinRecibo.length) {
        lines.push(`Sin recibo: ${sinRecibo.length} paquete(s) - solicitar dimensiones a almacen`);
      }
      return lines.join('\n');
    });
    const text = 'CARGA EN ALMACEN SIN FACTURA\n\n' + blocks.join('\n---\n\n');
    navigator.clipboard?.writeText(text).then(
      () => toast.success(`${withoutInvoice.length} orden(es) sin factura copiada(s)`),
      () => toast.error('No se pudo copiar')
    );
  };

  const handleMerge = async () => {
    if (!canMerge) return;
    setMerging(true);
    try {
      const res = await base44.functions.invoke('mergeDispatchOrders', { order_ids: selectedIds });
      const mergedOrder = res?.data?.order;
      const merged = res?.data?.merged || 0;
      const added = res?.data?.added || 0;

      // Actualización optimista inmediata: la orden destino queda con todos
      // los items y las órdenes fuente desaparecen de la lista al instante.
      if (mergedOrder) {
        const sourceIds = new Set(selectedIds.filter((id) => id !== mergedOrder.id));
        setOrders((prev) =>
          prev
            .filter((o) => !sourceIds.has(o.id))
            .map((o) => (o.id === mergedOrder.id ? { ...o, ...mergedOrder } : o))
        );
      }

      toast.success(`${merged + 1} órdenes fusionadas en una sola (+${added} paquetes)`);
      setSelectedIds([]);
      setSelectMode(false);

      // Recargar tras un breve delay para confirmar con datos frescos del servidor
      setTimeout(() => load(), 600);
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

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por orden, cliente, mark o tracking"
            className="pl-10"
          />
        </div>
        <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
          <SelectTrigger className="w-full sm:w-44 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-slate-400 shrink-0" />
              <SelectValue placeholder="Factura" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas (factura)</SelectItem>
            <SelectItem value="issued">Con factura emitida</SelectItem>
            <SelectItem value="paid">Factura pagada</SelectItem>
            <SelectItem value="not_issued">Sin factura</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dispatchFilter} onValueChange={setDispatchFilter}>
          <SelectTrigger className="w-full sm:w-44 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <SelectValue placeholder="Estado despacho" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las órdenes</SelectItem>
            <SelectItem value="despachado">Despachadas</SelectItem>
            <SelectItem value="no_despachado">No despachadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paidFilter} onValueChange={setPaidFilter}>
          <SelectTrigger className="w-full sm:w-44 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <DollarSign className="h-4 w-4 text-slate-400 shrink-0" />
              <SelectValue placeholder="Pago" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas (pago)</SelectItem>
            <SelectItem value="paid">Pagadas</SelectItem>
            <SelectItem value="unpaid">No pagadas</SelectItem>
          </SelectContent>
        </Select>
        {canFilterByCreator && (
        <Select value={creatorFilter} onValueChange={setCreatorFilter}>
          <SelectTrigger className="w-full sm:w-48 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <UserRound className="h-4 w-4 text-slate-400 shrink-0" />
              <SelectValue placeholder="Creado por" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los empleados</SelectItem>
            {creatorOptions.map((opt) => (
              <SelectItem key={opt.email} value={opt.email}>{opt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        )}
        <Button
          variant={showDuplicateReceipts ? "default" : "outline"}
          onClick={() => setShowDuplicateReceipts((v) => !v)}
          className="shrink-0"
          title="Mostrar solo órdenes no despachadas que comparten recibo con otra orden del mismo cliente"
        >
          <GitMerge className="h-4 w-4" />
          {showDuplicateReceipts ? 'Recibos dup. ON' : 'Recibos duplicados'}
        </Button>
        <Button
          variant={selectMode ? "default" : "outline"}
          onClick={() => { setSelectMode(!selectMode); setSelectedIds([]); }}
          className="shrink-0"
        >
          <GitMerge className="h-4 w-4" />
          {selectMode ? 'Cancelar' : 'Seleccionar'}
        </Button>
        <Button
          variant="outline"
          onClick={handleCopyAll}
          disabled={!filtered?.length}
          className="shrink-0"
        >
          <Copy className="h-4 w-4" />
          Copiar todos
        </Button>
        <Button
          variant="outline"
          onClick={handleCopyWithoutInvoice}
          disabled={!filtered?.length}
          className="shrink-0"
          title="Copiar al portapapeles las órdenes visibles que no tienen factura"
        >
          <Copy className="h-4 w-4" />
          Copiar sin factura
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="flex items-center gap-2 flex-1 w-full">
          <span className="text-sm text-slate-500 shrink-0">Desde</span>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 flex-1 w-full">
          <span className="text-sm text-slate-500 shrink-0">Hasta</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }} className="shrink-0">
            <X className="h-4 w-4" /> Limpiar fechas
          </Button>
        )}
      </div>

      {showDuplicateReceipts && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-700">
          <GitMerge className="h-4 w-4 shrink-0" />
          <span>
            Mostrando {filtered.length} orden(es) no despachadas que comparten número de recibo con otra orden del mismo cliente.
            Usa <strong>Seleccionar</strong> y elige las órdenes del mismo cliente para fusionarlas.
          </span>
        </div>
      )}

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
              invoiceInfo={invoiceInfoMap[order.id]}
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