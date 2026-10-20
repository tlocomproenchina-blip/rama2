import React, { useState, useEffect, useMemo, useCallback } from 'react';
// AdminInvoices — gestión de facturas y pagos
import { base44 } from '@/components/api/ApiQueueManager';
import { fetchAllPaginated } from '@/lib/fetchAllPaginated';
import { caracasRange } from '@/lib/caracasRange';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PaymentMethodsSettings from '@/components/admin/PaymentMethodsSettings';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import InvoiceCard from '@/components/invoice/InvoiceCard';
import ProviderCostControl from '@/components/invoice/ProviderCostControl';
import ProviderInvoiceUploader from '@/components/manual-billing/ProviderInvoiceUploader';
import DispatchReceiptModal from '@/components/invoice/DispatchReceiptModal';
import { FileText, Search, Loader2, Download, Edit, Trash2, PackageX, Package, MessageCircle, Truck, ClipboardList, Calculator } from 'lucide-react';
import InvoiceStatsCards from '@/components/invoice/InvoiceStatsCards';
import InvoiceTariffRecalcDialog from '@/components/invoice/recalc/InvoiceTariffRecalcDialog';
import StorageChargeDialog from '@/components/invoice/storage/StorageChargeDialog';
import StorageChargeInvoiceSummary from '@/components/invoice/storage/StorageChargeInvoiceSummary';
import StorageChargesAuditDialog from '@/components/invoice/storage/StorageChargesAuditDialog';
import OverdueInvoicesReportButton from '@/components/invoice/overdue/OverdueInvoicesReportButton';
import ContainersReportButton from '@/components/invoice/containers/ContainersReportButton';
import { fetchStorageTotals } from '@/lib/storageAudit';
import { billableTotal } from '@/lib/storageLines';
import WarehouseOrderModal from '@/components/invoice/WarehouseOrderModal';
import { generateWarehouseOrder } from '@/lib/warehouseOrder';
import WarehousePaidTable from '@/components/invoice/WarehousePaidTable';
import WarehouseOrderMissingNotice from '@/components/invoice/WarehouseOrderMissingNotice';
import WarehouseBillingTab from '@/components/invoice/warehouse-billing/WarehouseBillingTab';
import { buildWhatsAppUrl } from '@/lib/whatsappContact';
import { toast } from 'sonner';
import { ensureInvoicePaymentForPaidInvoice } from '@/lib/invoicePaymentSync';
import StateFilter from '@/components/common/StateFilter';

export default function AdminInvoices({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    revenue: 0,
    profit: 0,
    insuranceCollected: 0
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [consolidations, setConsolidations] = useState([]);
  const [selectedConsolidation, setSelectedConsolidation] = useState('');
  const [processing, setProcessing] = useState(false);
  const [deleteInvoice, setDeleteInvoice] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [deconsolidateConfirm, setDeconsolidateConfirm] = useState(null);
  const [deconsolidating, setDeconsolidating] = useState(false);
  const pageSize = 50;
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showPaymentsSettings, setShowPaymentsSettings] = useState(false);
  const [showTariffRecalc, setShowTariffRecalc] = useState(false);
  const [showStorageCharges, setShowStorageCharges] = useState(false);
  const [showStorageAudit, setShowStorageAudit] = useState(false);
  const [storageAuditFocus, setStorageAuditFocus] = useState(null);
  const [storageTotals, setStorageTotals] = useState({});
  const [appConfig, setAppConfig] = useState(null);
  const [dispatchReceipt, setDispatchReceipt] = useState(null);
  const [warehouseOrderInvoice, setWarehouseOrderInvoice] = useState(null);
  const [generatingOrderId, setGeneratingOrderId] = useState(null);
  // Facturas pagadas del período consultadas por FECHA DE PAGO (no por la página cargada).
  const [paidRange, setPaidRange] = useState(null);
  const [paidRangeLoading, setPaidRangeLoading] = useState(false);

  // Con el filtro de Pagadas y un período elegido, el listado y sus totales salen de la
  // consulta por fecha de pago: es el mismo criterio que la Orden de Despacho, así los
  // dos números coinciden.
  const rangeQueryActive = statusFilter === 'pagada' && !!(dateFrom || dateTo);

  // Inicialización en paralelo. Las consolidaciones se cargan solo al abrir
  // el modal de crear factura (no bloquean la carga inicial).
  useEffect(() => {
    (async () => {
      const [cfgs] = await Promise.all([
        base44.entities.AppConfig.filter({ config_key: 'main' }),
        loadInvoices(false),
      ]);
      setAppConfig(cfgs?.[0] || null);
    })();
  }, []);

  useEffect(() => {
    if (showCreateModal && consolidations.length === 0) loadConsolidations();
  }, [showCreateModal]);

  // Ganancia visible: descuenta las líneas de almacenamiento que están en pausa.
  const visibleProfit = (invoice) => {
    const stored = Number(invoice?.profit_amount || 0);
    const hidden = Number(invoice?.total || 0) - billableTotal(invoice);
    return stored - hidden;
  };

  const computeStats = (list) => {
    let paid = 0, pending = 0, revenue = 0, profit = 0, insuranceCollected = 0;
    for (const i of list) {
      if (i.status === 'pagada') {
        paid++; revenue += billableTotal(i);
        // Sumar items de seguro cobrados
        if (Array.isArray(i.items)) {
          for (const it of i.items) {
            const desc = String(it.description || '').toLowerCase();
            if (desc.includes('seguro') && it.total) {
              insuranceCollected += Number(it.total) || 0;
            }
          }
        }
      }
      else if (i.status === 'pendiente') pending++;
      if (i.profit_amount !== undefined && i.profit_amount !== null) profit += visibleProfit(i);
    }
    setStats({ total: list.length, paid, pending, revenue, profit, insuranceCollected });
  };

  const enrichInvoice = (inv, clientsByEmail) => {
    const u = clientsByEmail[inv.client_email];
    if (!u) return inv;
    return {
      ...inv,
      shipping_mark: u.shipping_mark || '',
      client_first_name: u.first_name || '',
      client_last_name: u.last_name || '',
      client_whatsapp: u.whatsapp || u.phone || '',
      client_cedula: u.cedula || '',
      client_address: u.address || '',
      client_city: u.city || '',
      client_state: u.state || ''
    };
  };

  // Trae TODAS las facturas pagadas del período por fecha de pago (hora de Caracas),
  // igual que la Orden de Despacho: no se queda en la página cargada, así el listado y
  // el conteo son los completos del rango.
  const loadPaidRange = useCallback(async () => {
    const from = dateFrom || dateTo;
    const to = dateTo || dateFrom;
    if (!from || !to) { setPaidRange(null); return; }
    setPaidRangeLoading(true);
    try {
      const { fromIso, toIso } = caracasRange(from, to);
      const all = await fetchAllPaginated('Invoice', {
        method: 'filter',
        query: { status: 'pagada', payment_date: { $gte: fromIso, $lt: toIso } },
        sort: '-payment_date',
      });
      let list = all || [];
      const clientEmails = Array.from(new Set(list.map(inv => inv.client_email).filter(Boolean)));
      if (clientEmails.length) {
        const res = await base44.functions.invoke('getClientsByEmails', { emails: clientEmails }, { opType: 'read', priority: 'HIGH' }).catch(() => null);
        const clientsByEmail = res?.data?.clients || {};
        if (Object.keys(clientsByEmail).length) {
          list = list.map(inv => enrichInvoice(inv, clientsByEmail));
        }
      }
      setPaidRange(list);
    } catch (error) {
      setPaidRange([]);
      toast.error('No se pudieron cargar las facturas pagadas del período');
    }
    setPaidRangeLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (rangeQueryActive) loadPaidRange();
    else setPaidRange(null);
  }, [rangeQueryActive, loadPaidRange]);

  // Las tarjetas de resumen siguen al listado que se está mostrando: con el período activo
  // cuentan todas las facturas pagadas del rango, no solo la página cargada.
  useEffect(() => {
    computeStats(rangeQueryActive ? (paidRange || []) : invoices);
  }, [rangeQueryActive, paidRange, invoices]);

  // Totales de almacenamiento ya sumados a cada factura (una sola consulta).
  const invoiceIdsKey = useMemo(() => invoices.map(inv => inv.id).join(','), [invoices]);
  useEffect(() => {
    if (!invoiceIdsKey) return;
    fetchStorageTotals().then(setStorageTotals);
  }, [invoiceIdsKey]);

  const loadInvoices = async (append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    const skip = append ? invoices.length : 0;
    const data = await base44.entities.Invoice.list('-invoice_date', pageSize, skip);

    // FASE 1: mostrar las facturas de inmediato (sin esperar los datos del cliente)
    const baseList = append ? [...invoices, ...(data || [])] : (data || []);
    setInvoices(baseList);
    setHasMore(data.length === pageSize);
    if (append) setLoadingMore(false); else setLoading(false);

    // FASE 2: enriquecer con datos del cliente en segundo plano
    const clientEmails = Array.from(new Set((data || []).map(inv => inv.client_email).filter(Boolean)));
    if (clientEmails.length) {
      const res = await base44.functions.invoke('getClientsByEmails', { emails: clientEmails }, { opType: 'read', priority: 'HIGH' }).catch(() => null);
      const clientsByEmail = res?.data?.clients || {};
      if (Object.keys(clientsByEmail).length) {
        setInvoices(prev => prev.map(inv => (inv.client_first_name || inv.shipping_mark) ? inv : enrichInvoice(inv, clientsByEmail)));
      }
    }

    // Si el período por fecha de pago está activo, se rehace para que el listado siga
    // cuadrando con lo que se acaba de cambiar en las facturas.
    if (rangeQueryActive) loadPaidRange();
  };

  const loadConsolidations = async () => {
    const data = await fetchAllPaginated('Consolidation', { sort: '-created_date' });
    setConsolidations(data);
  };

  const handleCreateInvoice = async () => {
    if (!selectedConsolidation) {
      toast.error('Selecciona una consolidación');
      return;
    }

    setProcessing(true);
    try {
      const consolidation = consolidations.find(c => c.id === selectedConsolidation);
      const { generateInvoice } = await import('@/components/invoice/InvoiceGenerator');
      await generateInvoice(consolidation);
      
      toast.success('Factura creada exitosamente');
      setShowCreateModal(false);
      setSelectedConsolidation('');
      loadInvoices();
    } catch (error) {
      toast.error('Error al crear factura');
    }
    setProcessing(false);
  };

  // Arma la orden de almacén de una factura marcada como pagada y la guarda dentro
  // de la factura. Devuelve 'ok' (con la orden), 'vacio' (la factura no tiene bultos)
  // o 'error'. No avisa por sí sola: cada llamador decide qué informar.
  const generateOrderForInvoice = async (invoice) => {
    try {
      const data = await generateWarehouseOrder(invoice.id);
      if (data?.order) {
        setInvoices(prev => prev.map(i => (i.id === invoice.id ? { ...i, warehouse_order: data.order } : i)));
        return 'ok';
      }
      if (data?.empty) return 'vacio';
      return 'error';
    } catch (error) {
      return 'error';
    }
  };

  // Un toque desde la fila: arma la orden de almacén de una factura que quedó pagada
  // sin orden (pagos anteriores a la generación automática, o pagadas sin bultos aún).
  const handleGenerateOrderFromRow = async (invoice) => {
    setGeneratingOrderId(invoice.id);
    const result = await generateOrderForInvoice(invoice);
    if (result === 'ok') toast.success('Orden de almacén generada');
    else if (result === 'vacio') toast.warning('Esta factura todavía no tiene bultos vinculados: no se generó orden');
    else toast.error('No se pudo generar la orden de almacén');
    setGeneratingOrderId(null);
  };

  const handleEditInvoice = async () => {
    if (!editingInvoice) return;

    setProcessing(true);
    try {
      const updatePayload = {
        status: editingInvoice.status,
        notes: editingInvoice.notes,
        provider_invoice_image_url: editingInvoice.provider_invoice_image_url || null,
      };
      if (editingInvoice.payment_method) updatePayload.payment_method = editingInvoice.payment_method;
      if (editingInvoice.payment_reference) updatePayload.payment_reference = editingInvoice.payment_reference;
      if (editingInvoice.status === 'pagada' && !editingInvoice.payment_date) updatePayload.payment_date = new Date().toISOString();
      await base44.entities.Invoice.update(editingInvoice.id, updatePayload);

      // Sincronizar InvoicePayment para que aparezca en el Historial de AdminPayments
      if (editingInvoice.status === 'pagada') {
        await ensureInvoicePaymentForPaidInvoice(base44, editingInvoice, user?.email);
      }

      // Al marcar la factura como pagada a mano se arma su orden de almacén.
      const previous = invoices.find(i => i.id === editingInvoice.id);
      if (editingInvoice.status === 'pagada' && previous && previous.status !== 'pagada') {
        const result = await generateOrderForInvoice(editingInvoice);
        if (result === 'ok') toast.success('Orden de almacén generada');
        else if (result === 'vacio') toast.warning('La factura no tiene bultos vinculados: no se generó orden de almacén');
        else toast.error('No se pudo generar la orden de almacén');
      }

      toast.success('Factura actualizada');
      setShowEditModal(false);
      setEditingInvoice(null);
      loadInvoices();
    } catch (error) {
      toast.error('Error al actualizar factura');
    }
    setProcessing(false);
  };

  // Libera los registros de CBM facturados manualmente vinculados a una factura
  const releaseBilledCbm = async (invoiceId) => {
    const billedCbm = await base44.entities.CbmIngreso.filter({ billed_invoice_id: invoiceId }).catch(() => []);
    if (billedCbm && billedCbm.length > 0) {
      await Promise.all(billedCbm.map(c => base44.entities.CbmIngreso.update(c.id, { billed: false, billed_invoice_id: null })));
    }
    return billedCbm?.length || 0;
  };

  const handleDeleteInvoice = async () => {
    if (!deleteInvoice) return;
    
    setDeleting(true);
    try {
      const released = await releaseBilledCbm(deleteInvoice.id);
      await base44.entities.Invoice.delete(deleteInvoice.id);
      toast.success(released > 0
        ? `Factura eliminada. ${released} registro(s) liberado(s) en Facturación Manual.`
        : 'Factura eliminada exitosamente');
      setDeleteInvoice(null);
      loadInvoices();
    } catch (error) {
      toast.error('Error al eliminar factura');
    }
    setDeleting(false);
  };

  const handleDownloadPDF = async (invoice) => {
    // Config de la empresa
    const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
    const cfg = configs[0] || {};

    // Datos del cliente desde el punto único de verdad (getClientsByEmails)
    let clientUser = null;
    if (invoice.client_email) {
      try {
        const res = await base44.functions.invoke('getClientsByEmails', { emails: [invoice.client_email] });
        clientUser = res?.data?.clients?.[invoice.client_email] || null;
      } catch { clientUser = null; }
    }

    const { buildInvoicePdf } = await import('@/components/invoice/InvoicePdfBuilder');
    const doc = await buildInvoicePdf(invoice, cfg, clientUser);
    doc.save(`factura-${invoice.invoice_number}.pdf`);
    toast.success('Factura descargada');
  };



  const handleExportAll = () => {
    const csv = ['Número,Cliente,Fecha,Total,Costo Proveedor,Ganancia,Estado,Método de Pago'];
    invoices.forEach(inv => {
      csv.push([
        inv.invoice_number,
        inv.client_email,
        new Date(inv.invoice_date).toLocaleDateString(),
        Number(inv.total || 0).toFixed(2),
        inv.provider_cost_total != null ? Number(inv.provider_cost_total).toFixed(2) : '',
        inv.profit_amount != null ? Number(inv.profit_amount).toFixed(2) : '',
        inv.status,
        inv.payment_method || 'N/A'
      ].join(','));
    });
    
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `facturas-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success('Reporte exportado');
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedInvoices(filteredInvoices.map(i => i.id));
    } else {
      setSelectedInvoices([]);
    }
  };

  const handleSelectInvoice = (invId, checked) => {
    if (checked) {
      setSelectedInvoices([...selectedInvoices, invId]);
    } else {
      setSelectedInvoices(selectedInvoices.filter(id => id !== invId));
    }
  };

  const handleBulkAction = () => {
    if (!bulkAction) {
      toast.error('Selecciona una acción');
      return;
    }
    if (selectedInvoices.length === 0) {
      toast.error('Selecciona al menos una factura');
      return;
    }
    if (bulkAction === 'status' && !bulkStatus) {
      toast.error('Selecciona un estado');
      return;
    }
    setShowBulkConfirm(true);
  };

  const executeBulkAction = async () => {
    setBulkProcessing(true);
    try {
      const selectedInvs = sourceInvoices.filter(i => selectedInvoices.includes(i.id));

      if (bulkAction === 'delete') {
        await Promise.all(selectedInvs.map(inv => releaseBilledCbm(inv.id)));
        await Promise.all(selectedInvs.map(inv => 
          base44.entities.Invoice.delete(inv.id)
        ));
        toast.success(`${selectedInvoices.length} factura(s) eliminada(s)`);
      } else if (bulkAction === 'status') {
        const now = new Date().toISOString();
        await Promise.all(selectedInvs.map(inv => {
          const payload = { status: bulkStatus };
          if (bulkStatus === 'pagada' && !inv.payment_date) payload.payment_date = now;
          return base44.entities.Invoice.update(inv.id, payload);
        }));

        let orderInfo = '';
        if (bulkStatus === 'pagada') {
          // Sincronizar InvoicePayment para que aparezcan en el Historial de AdminPayments
          await Promise.all(selectedInvs
            .map(inv => ensureInvoicePaymentForPaidInvoice(base44, { ...inv, status: 'pagada', payment_date: inv.payment_date || now }, user?.email))
          );

          // Órdenes de almacén de las facturas que acaban de quedar pagadas. Si alguna
          // no tiene bultos, el resto sigue igual y se informa al final.
          const recienPagadas = selectedInvs.filter(inv => inv.status !== 'pagada');
          const results = await Promise.all(recienPagadas.map(inv => generateOrderForInvoice(inv)));
          const generated = results.filter(r => r === 'ok').length;
          const withoutBultos = results.filter(r => r === 'vacio').length;
          orderInfo = `${generated ? ` · ${generated} orden(es) de almacén generada(s)` : ''}${withoutBultos ? ` · ${withoutBultos} sin bultos` : ''}`;
        }

        toast.success(`${selectedInvoices.length} factura(s) actualizada(s)${orderInfo}`);
      }

      setSelectedInvoices([]);
      setBulkAction('');
      setBulkStatus('');
      setShowBulkConfirm(false);
      loadInvoices();
    } catch (error) {
      toast.error('Error al ejecutar acción masiva');
    }
    setBulkProcessing(false);
  };

  const handleNotifyPayment = (invoice) => {
    const phone = invoice.client_whatsapp;
    const name = (invoice.client_first_name || '').trim() || 'estimado cliente';
    const message = `Hola ${name}, le contactamos de TLEC CARGO. Tiene una factura pendiente de pago (${invoice.invoice_number || ''}) por un monto de $${billableTotal(invoice).toFixed(2)}. Agradecemos su pago a la brevedad para poder realizar el despacho de su carga. ¡Gracias!`;
    const url = buildWhatsAppUrl(phone, message);
    if (!url) {
      toast.error('Este cliente no tiene número de WhatsApp registrado');
      return;
    }
    window.open(url, '_blank');
  };

  // Suma un abono al total pagado al proveedor (acumulación), recalcula la
  // ganancia, registra el abono en el historial y sincroniza la Cuenta por Pagar.
  const handleSaveProviderCost = async (invoice, enteredAmount, description = '') => {
    try {
      // provider_cost_total es el COSTO del proveedor (fijo), no se modifica.
      // Solo registramos el abono en el historial.
      const history = Array.isArray(invoice.provider_payment_history) ? invoice.provider_payment_history : [];
      const newHistory = [...history, { description, amount: Number(enteredAmount), date: new Date().toISOString() }];
      const totalPaid = newHistory.reduce((sum, h) => sum + Number(h.amount || 0), 0);
      const providerCost = Number(invoice.provider_cost_total || 0);
      const profit = billableTotal(invoice) - providerCost;
      await base44.entities.Invoice.update(invoice.id, {
        provider_payment_history: newHistory
      });

      // Sincronizar Cuentas por Pagar: el acumulado (suma de abonos) es lo pagado.
      if (invoice.consolidation_id) {
        const aps = await base44.entities.AccountsPayable.filter({ related_consolidation_id: invoice.consolidation_id }).catch(() => []);
        if (aps && aps.length > 0) {
          await Promise.all(aps.map(ap => {
            const original = Number(ap.original_amount_due || 0);
            const balance = Math.max(0, original - totalPaid);
            return base44.entities.AccountsPayable.update(ap.id, {
              amount_paid: totalPaid,
              balance_due: ap.status === 'pagado' ? 0 : balance
            });
          }));
        }
      }

      setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, provider_payment_history: newHistory } : i));
      setStats(prev => {
        const oldProfit = (invoice.profit_amount != null) ? visibleProfit(invoice) : 0;
        return { ...prev, profit: Number(prev.profit || 0) - oldProfit + profit };
      });
      toast.success('Abono registrado');
    } catch (error) {
      toast.error('Error al guardar el abono del proveedor');
    }
  };

  // Edita un abono existente del historial: ajusta el acumulado y la ganancia.
  const handleEditProviderAbono = async (invoice, index, newAmount, newDescription, newDate) => {
    try {
      const history = Array.isArray(invoice.provider_payment_history) ? invoice.provider_payment_history : [];
      const oldAbono = history[index];
      if (!oldAbono) return;
      const oldAmount = Number(oldAbono.amount || 0);
      const updatedAbono = {
        ...oldAbono,
        description: newDescription,
        amount: Number(newAmount),
        date: newDate ? new Date(newDate).toISOString() : oldAbono.date
      };
      const newHistory = history.map((item, i) => (i === index ? updatedAbono : item));
      await base44.entities.Invoice.update(invoice.id, {
        provider_payment_history: newHistory
      });
      setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, provider_payment_history: newHistory } : i));
      toast.success('Abono actualizado');
    } catch (error) {
      toast.error('Error al editar el abono');
    }
  };

  // Elimina un abono del historial y resta su monto del acumulado.
  const handleDeleteProviderAbono = async (invoice, index) => {
    try {
      const history = Array.isArray(invoice.provider_payment_history) ? invoice.provider_payment_history : [];
      const abono = history[index];
      if (!abono) return;
      const newHistory = history.filter((_, i) => i !== index);
      await base44.entities.Invoice.update(invoice.id, {
        provider_payment_history: newHistory
      });
      setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, provider_payment_history: newHistory } : i));
      toast.success('Abono eliminado del historial');
    } catch (error) {
      toast.error('Error al eliminar el abono');
    }
  };

  const handleToggleProviderPaid = async (invoice, checked) => {
    try {
      const paidDate = checked ? new Date().toISOString() : null;
      await base44.entities.Invoice.update(invoice.id, { provider_paid: checked, provider_paid_date: paidDate });

      // Sincronizar la cuenta por pagar asociada (por consolidación)
      if (invoice.consolidation_id) {
        const aps = await base44.entities.AccountsPayable.filter({ related_consolidation_id: invoice.consolidation_id }).catch(() => []);
        await Promise.all((aps || []).map(ap => base44.entities.AccountsPayable.update(ap.id, checked
          ? { status: 'pagado', amount_paid: Number(ap.original_amount_due || 0), balance_due: 0, payment_date: paidDate }
          : { status: 'pendiente', amount_paid: 0, balance_due: Number(ap.original_amount_due || 0), payment_date: null }
        )));
      }

      const updatedInvoice = { ...invoice, provider_paid: checked, provider_paid_date: paidDate };
      setInvoices(prev => prev.map(i => i.id === invoice.id ? updatedInvoice : i));
      toast.success(checked ? 'Marcado como pagado al proveedor' : 'Pago al proveedor revertido');

      // Al marcar como pagado al proveedor, generar el recibo de despacho para copiar
      if (checked) {
        openDispatchReceipt(updatedInvoice);
      }
    } catch (error) {
      toast.error('Error al actualizar pago al proveedor');
    }
  };

  // Guarda/quita la imagen de la factura del proveedor (ImgBB, uso interno)
  const handleSaveProviderInvoiceImage = async (invoice, url) => {
    try {
      await base44.entities.Invoice.update(invoice.id, { provider_invoice_image_url: url || null });
      setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, provider_invoice_image_url: url || null } : i));
      if (!url) toast.success('Imagen de factura del proveedor eliminada');
    } catch (error) {
      toast.error('No se pudo guardar la imagen de la factura');
    }
  };

  // Abre el recibo de despacho con los datos del cliente
  const openDispatchReceipt = (invoice) => {
    setDispatchReceipt(invoice);
  };

  const handleDeconsolidate = async (invoice) => {
    if (!invoice.consolidation_id) {
      toast.error('Esta factura no tiene consolidación asociada');
      return;
    }
    setDeconsolidateConfirm(invoice);
  };

  const executeDeconsolidation = async () => {
    if (!deconsolidateConfirm) return;

    setDeconsolidating(true);
    try {
      // Caso factura manual combinada: liberar registros de CBM y eliminar la factura
      const billedCbm = await base44.entities.CbmIngreso.filter({ billed_invoice_id: deconsolidateConfirm.id }).catch(() => []);
      if (billedCbm && billedCbm.length > 0) {
        await Promise.all(billedCbm.map(c => base44.entities.CbmIngreso.update(c.id, { billed: false, billed_invoice_id: null })));
        await base44.entities.Invoice.delete(deconsolidateConfirm.id);
        toast.success(`Factura desconsolidada. ${billedCbm.length} registro(s) liberado(s) en Facturación Manual.`);
        setDeconsolidateConfirm(null);
        loadInvoices();
        setDeconsolidating(false);
        return;
      }

      const consolidation = await base44.entities.Consolidation.filter({ 
        id: deconsolidateConfirm.consolidation_id 
      });

      if (!consolidation || consolidation.length === 0) {
        toast.error('Consolidación no encontrada');
        setDeconsolidating(false);
        return;
      }

      const cons = consolidation[0];
      const packageIds = cons.package_ids || [];

      // Revert package statuses to "recibido" and remove consolidation_id
      await Promise.all(packageIds.map(pkgId => 
        base44.entities.Package.update(pkgId, {
          status: 'recibido',
          consolidation_id: null
        })
      ));

      // Delete the consolidation
      await base44.entities.Consolidation.delete(cons.id);

      // Update consolidation request if exists
      if (cons.consolidation_request_id) {
        await base44.entities.ConsolidationRequest.update(cons.consolidation_request_id, {
          status: 'pendiente',
          consolidation_id: null
        });
      }

      // Delete the invoice
      await base44.entities.Invoice.delete(deconsolidateConfirm.id);

      // Delete related Accounts Payable records
      const aps = await base44.entities.AccountsPayable.filter({ related_consolidation_id: cons.id });
      if (aps && aps.length > 0) {
        await Promise.all(aps.map(ap => base44.entities.AccountsPayable.delete(ap.id)));
      }

      // Notify client
      const { sendNotification } = await import('@/components/NotificationUtils');
      sendNotification({
        to: cons.client_email,
        subject: '📦 Consolidación desconsolidada',
        body: `Tu consolidación ${cons.consolidation_tracking} ha sido desconsolidada.\n\nTus ${packageIds.length} paquete(s) están nuevamente disponibles en estado "Recibido" para ser consolidados en el futuro.`,
        type: 'consolidation',
        icon: 'package',
        referenceId: cons.id
      });

      toast.success('Consolidación desconsolidada exitosamente');
      setDeconsolidateConfirm(null);
      loadInvoices();
      loadConsolidations();
    } catch (error) {
      console.error('Error deconsolidating:', error);
      toast.error('Error al desconsolidar');
    }
    setDeconsolidating(false);
  };

  // Listado base: con el período activo son todas las pagadas del rango (por fecha de pago);
  // en el resto de los casos, la página de facturas cargada.
  const sourceInvoices = rangeQueryActive ? (paidRange || []) : invoices;

  const filteredInvoices = useMemo(() => {
    const q = search.toLowerCase();
    const fromMs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null;
    const toMs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;
    return sourceInvoices.filter(inv => {
      const matchesSearch = !q || (
        (inv.invoice_number || '').toLowerCase().includes(q) ||
        (inv.client_email || '').toLowerCase().includes(q) ||
        (inv.client_cedula || '').toLowerCase().includes(q) ||
        (inv.consolidation_tracking || '').toLowerCase().includes(q) ||
        (inv.shipping_mark || '').toLowerCase().includes(q) ||
        `${inv.client_first_name || ''} ${inv.client_last_name || ''}`.toLowerCase().includes(q)
      );
      const matchesStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'provider_unpaid' ? (inv.status === 'pagada' && !inv.provider_paid) :
        statusFilter === 'vencida' ? (() => {
          const days = inv.invoice_date ? Math.floor((Date.now() - new Date(inv.invoice_date).getTime()) / 86400000) : 0;
          const hasPartialPayment = Number(inv.paid_amount || 0) > 0;
          return days >= 20 && inv.status !== 'pagada' && inv.status !== 'cancelada' && !hasPartialPayment;
        })() :
        inv.status === statusFilter;
      const invDate = inv.invoice_date ? new Date(inv.invoice_date).getTime() : null;
      // Con el período activo el rango ya lo aplicó el servidor (por fecha de pago).
      const matchesDate = rangeQueryActive || !invDate || (
        (fromMs === null || invDate >= fromMs) &&
        (toMs === null || invDate <= toMs)
      );
      const matchesState = stateFilter === 'all' ? true :
        String(inv.client_state || '').trim().toLowerCase() === stateFilter;
      return matchesSearch && matchesStatus && matchesDate && matchesState;
    });
  }, [sourceInvoices, rangeQueryActive, search, statusFilter, stateFilter, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Facturas</h1>
          <p className="text-slate-500">Administra facturas y pagos de clientes</p>
        </div>
        <div className="header-actions flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setShowTariffRecalc(true)}>
            <Calculator className="h-4 w-4 mr-2" />
            Recalcular tarifas
          </Button>
          <Button variant="outline" onClick={() => setShowStorageCharges(true)}>
            <Package className="h-4 w-4 mr-2" />
            Cargos de almacenamiento
          </Button>
          <Button
            variant="outline"
            onClick={() => { setStorageAuditFocus(null); setShowStorageAudit(true); }}
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Cargos y avisos por factura
          </Button>
          <ContainersReportButton />
          <Button onClick={handleExportAll} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <InvoiceStatsCards stats={stats} />

      {/* Search & Date Filter */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número, cliente, shipping mark o tracking..."
              className="pl-10"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-slate-500">Desde</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-slate-500">Hasta</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="outline"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
              >
                Limpiar fechas
              </Button>
            )}
          </div>
          {rangeQueryActive && (
            <p className="text-xs text-slate-500">
              {paidRangeLoading
                ? 'Buscando todas las facturas pagadas del período…'
                : `${(paidRange || []).length} factura(s) pagada(s) en el período, contadas por fecha de pago (mismo criterio que Orden de Despacho).`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="flex-1">
          <TabsList className="flex-wrap gap-1 overflow-x-auto sm:overflow-visible">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
            <TabsTrigger value="pagada">Pagadas</TabsTrigger>
            <TabsTrigger value="vencida">Vencidas</TabsTrigger>
            <TabsTrigger value="provider_unpaid">No pagadas al proveedor</TabsTrigger>
            <TabsTrigger value="carga_almacen">
              <Truck className="h-3.5 w-3.5 mr-1" />
              Carga en almacén
            </TabsTrigger>
            <TabsTrigger value="en_almacen">
              <Package className="h-3.5 w-3.5 mr-1" />
              En Almacén
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {statusFilter !== 'carga_almacen' && (
          <StateFilter
            items={sourceInvoices}
            extractState={(inv) => inv.client_state}
            value={stateFilter}
            onChange={setStateFilter}
            className="w-full sm:w-56 shrink-0"
          />
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedInvoices.length > 0 && (
        <Card className="border-0 shadow-lg bg-blue-50">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedInvoices.length === filteredInvoices.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium text-slate-700">
                  {selectedInvoices.length} factura(s) seleccionada(s)
                </span>
              </div>
              
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <Select value={bulkAction} onValueChange={setBulkAction}>
                  <SelectTrigger className="w-48 bg-white">
                    <SelectValue placeholder="Acción masiva" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Cambiar Estado</SelectItem>
                    <SelectItem value="delete">Eliminar</SelectItem>
                  </SelectContent>
                </Select>

                {bulkAction === 'status' && (
                  <Select value={bulkStatus} onValueChange={setBulkStatus}>
                    <SelectTrigger className="w-40 bg-white">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="pagada">Pagada</SelectItem>
                      <SelectItem value="vencida">Vencida</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <Button 
                  onClick={handleBulkAction}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Aplicar
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedInvoices([])}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Carga en almacén pendiente de facturar */}
      {statusFilter === 'carga_almacen' ? (
        <WarehouseBillingTab search={search} />
      ) : statusFilter === 'en_almacen' ? (
        <WarehousePaidTable
          search={search}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      ) : (
      <>
      {/* Informe imprimible de las facturas vencidas */}
      {statusFilter === 'vencida' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2">
          <p className="text-xs text-red-800">
            Informe para impresión con shipping mark, contenedor, tracking, cliente y total de las facturas vencidas que ves aquí.
          </p>
          <OverdueInvoicesReportButton
            invoices={filteredInvoices}
            appName={appConfig?.app_name || 'TLEC CARGO'}
          />
        </div>
      )}

      {/* Invoice List */}
      {filteredInvoices.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-slate-300 mb-4" />
            <p className="text-slate-500">No se encontraron facturas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredInvoices.map(invoice => (
            <div key={invoice.id} className="flex flex-col lg:flex-row gap-3 items-stretch overflow-hidden lg:overflow-visible">
              <div className="flex-1 min-w-0 overflow-hidden">
                <InvoiceCard
                  invoice={invoice}
                  onDownload={handleDownloadPDF}
                  showPayButton={false}
                  showInsuranceBreakdown={true}
                  isAdmin={true}
                  onRefresh={loadInvoices}
                  selectionControl={(
                    <Checkbox 
                      checked={selectedInvoices.includes(invoice.id)}
                      onCheckedChange={(checked) => handleSelectInvoice(invoice.id, checked)}
                      className="bg-white"
                    />
                  )}
                  extraActions={(
                    <div className="w-full space-y-3">
                      <StorageChargeInvoiceSummary
                        invoice={invoice}
                        summary={storageTotals[invoice.id]}
                        onOpenDetail={(inv) => { setStorageAuditFocus(inv.id); setShowStorageAudit(true); }}
                      />
                      {invoice.status === 'pendiente' && invoice.client_whatsapp && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleNotifyPayment(invoice); }}
                          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                        >
                          <MessageCircle className="h-4 w-4" /> Notificar pago
                        </button>
                      )}
                      <ProviderCostControl
                        invoice={invoice}
                        onSaveCost={handleSaveProviderCost}
                        onTogglePaid={handleToggleProviderPaid}
                        onDeleteAbono={handleDeleteProviderAbono}
                        onEditAbono={handleEditProviderAbono}
                      />
                      <div onClick={(e) => e.stopPropagation()}>
                        <ProviderInvoiceUploader
                          value={invoice.provider_invoice_image_url || ''}
                          onChange={(url) => handleSaveProviderInvoiceImage(invoice, url)}
                        />
                      </div>
                    </div>
                  )}
                />
              </div>
              {/* Columna lateral derecha: badges + acciones apiladas */}
              <div className="flex flex-row flex-wrap lg:flex-col gap-2 w-full lg:w-44 shrink-0 items-stretch content-start">
                {invoice.profit_amount != null && (
                  <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-full text-center whitespace-nowrap ${visibleProfit(invoice) >= 0 ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}`}>
                    Ganancia: ${visibleProfit(invoice).toFixed(2)}
                  </span>
                )}
                {invoice.provider_paid && (
                  <span className="text-xs font-semibold px-2.5 py-1.5 rounded-full text-center whitespace-nowrap bg-emerald-100 text-emerald-700">
                    ✓ Pagado al proveedor
                  </span>
                )}
                {invoice.warehouse_order && (
                  <span className="text-xs font-semibold px-2.5 py-1.5 rounded-full text-center whitespace-nowrap bg-blue-100 text-blue-700">
                    Orden almacén: {Number(invoice.warehouse_order.totals?.bultos) || 0} bulto(s)
                  </span>
                )}
                {invoice.status === 'pagada' && !invoice.warehouse_order && (
                  <WarehouseOrderMissingNotice
                    working={generatingOrderId === invoice.id}
                    onGenerate={() => handleGenerateOrderFromRow(invoice)}
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    setEditingInvoice(invoice);
                    setShowEditModal(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                {invoice.provider_paid && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDispatchReceipt(invoice)}
                    className="justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Truck className="h-4 w-4 mr-1" />
                    Recibo despacho
                  </Button>
                )}
                {invoice.status === 'pagada' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWarehouseOrderInvoice(invoice)}
                    className="justify-start text-slate-700"
                  >
                    <ClipboardList className="h-4 w-4 mr-1" />
                    Orden de almacén
                  </Button>
                )}
                {invoice.consolidation_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeconsolidate(invoice)}
                    className="justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  >
                    <PackageX className="h-4 w-4 mr-1" />
                    Desconsolidar
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteInvoice(invoice)}
                  className="justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Borrar
                </Button>
              </div>
            </div>
          ))}
        </div>
        )}

        {hasMore && !rangeQueryActive && (
          <Button variant="outline" className="w-full mt-4" onClick={() => loadInvoices(true)} disabled={loadingMore}>
            {loadingMore ? 'Cargando...' : 'Cargar más'}
          </Button>
        )}
      </>
      )}

        {/* Create Invoice Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Factura Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Seleccionar Consolidación</Label>
              <Select value={selectedConsolidation} onValueChange={setSelectedConsolidation}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una consolidación" />
                </SelectTrigger>
                <SelectContent>
                  {consolidations.map(cons => (
                    <SelectItem key={cons.id} value={cons.id}>
                      {cons.consolidation_tracking} - {cons.client_email} - ${Number(cons.total_cost || 0).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateInvoice} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Crear Factura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Factura</DialogTitle>
          </DialogHeader>
          {editingInvoice && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select 
                  value={editingInvoice.status} 
                  onValueChange={(val) => setEditingInvoice({...editingInvoice, status: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="pagada">Pagada</SelectItem>
                    <SelectItem value="vencida">Vencida</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input
                  value={editingInvoice.notes || ''}
                  onChange={(e) => setEditingInvoice({...editingInvoice, notes: e.target.value})}
                  placeholder="Notas adicionales..."
                />
              </div>

              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select 
                  value={editingInvoice.payment_method || ''}
                  onValueChange={(val) => setEditingInvoice({...editingInvoice, payment_method: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona método" />
                  </SelectTrigger>
                  <SelectContent>
                    {appConfig?.payments_enable_binance !== false && <SelectItem value="binance">Binance</SelectItem>}
                    {appConfig?.payments_enable_usdt_trc20 !== false && <SelectItem value="usdt_trc20">USDT TRC20</SelectItem>}
                    {appConfig?.payments_enable_paypal !== false && <SelectItem value="paypal">PayPal</SelectItem>}
                    {appConfig?.payments_enable_debito_internacional !== false && <SelectItem value="debito_internacional">Débito Internacional</SelectItem>}
                    {appConfig?.payments_enable_wally !== false && <SelectItem value="wally">Wally</SelectItem>}
                    {appConfig?.payments_enable_zinli !== false && <SelectItem value="zinli">Zinli</SelectItem>}
                    {appConfig?.payments_enable_wise !== false && <SelectItem value="wise">Wise</SelectItem>}
                    {appConfig?.payments_enable_skrill !== false && <SelectItem value="skrill">Skrill</SelectItem>}
                    {appConfig?.payments_enable_pago_movil_usdt !== false && <SelectItem value="pago_movil_usdt">Pago Móvil → USDT</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Referencia de pago</Label>
                <Input
                  value={editingInvoice.payment_reference || ''}
                  onChange={(e) => setEditingInvoice({...editingInvoice, payment_reference: e.target.value})}
                  placeholder="Ej: ID de transacción, voucher, etc."
                />
              </div>

              <ProviderInvoiceUploader
                value={editingInvoice.provider_invoice_image_url || ''}
                onChange={(url) => setEditingInvoice({ ...editingInvoice, provider_invoice_image_url: url })}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditInvoice} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Métodos de Pago (Admin) */}
      {showPaymentsSettings && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow w-full max-w-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Métodos de Pago</h3>
              <button className="text-slate-500" onClick={() => setShowPaymentsSettings(false)}>Cerrar</button>
            </div>
            <PaymentMethodsSettings onSaved={() => setShowPaymentsSettings(false)} />
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteInvoice} onOpenChange={() => setDeleteInvoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar la factura{' '}
              <span className="font-semibold text-slate-800">{deleteInvoice?.invoice_number}</span>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteInvoice();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Eliminando...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Eliminar</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deconsolidate Confirmation Dialog */}
      <AlertDialog open={!!deconsolidateConfirm} onOpenChange={() => setDeconsolidateConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconsolidar Consolidación?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de desconsolidar la factura{' '}
              <span className="font-semibold text-slate-800">{deconsolidateConfirm?.invoice_number}</span>
              {' '}asociada a la consolidación{' '}
              <span className="font-semibold text-slate-800">{deconsolidateConfirm?.consolidation_tracking}</span>.
              <br /><br />
              Esto hará lo siguiente:
              <ul className="list-disc ml-6 mt-2">
                <li>Los paquetes volverán al estado <strong>"Recibido"</strong></li>
                <li>Se eliminará la consolidación</li>
                <li>Se eliminará esta factura</li>
                <li>Los paquetes podrán ser consolidados nuevamente</li>
              </ul>
              <br />
              <strong>Esta acción no se puede deshacer.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deconsolidating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                executeDeconsolidation();
              }}
              disabled={deconsolidating}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {deconsolidating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Desconsolidando...</>
              ) : (
                <><PackageX className="h-4 w-4 mr-2" /> Desconsolidar</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Confirmation */}
      <AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Acción Masiva</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'delete' ? (
                <>
                  Estás a punto de <span className="font-semibold text-red-600">eliminar {selectedInvoices.length} factura(s)</span>.
                  Esta acción no se puede deshacer.
                </>
              ) : bulkAction === 'status' ? (
                <>
                  Cambiarás el estado de <span className="font-semibold">{selectedInvoices.length} factura(s)</span> a{' '}
                  <span className="font-semibold text-blue-600">{bulkStatus}</span>.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                executeBulkAction();
              }}
              disabled={bulkProcessing}
              className={bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {bulkProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
              ) : (
                <>Confirmar</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recálculo de tarifas por tipo de carga de cada recibo */}
      <StorageChargeDialog
        open={showStorageCharges}
        onOpenChange={setShowStorageCharges}
        onApplied={() => loadInvoices()}
      />

      {/* Cargos de almacenamiento y avisos ya enviados, factura por factura */}
      <StorageChargesAuditDialog
        open={showStorageAudit}
        onOpenChange={(value) => { setShowStorageAudit(value); if (!value) setStorageAuditFocus(null); }}
        focusInvoiceId={storageAuditFocus}
      />

      <InvoiceTariffRecalcDialog
        open={showTariffRecalc}
        onOpenChange={setShowTariffRecalc}
        onApplied={() => loadInvoices(false)}
      />

      {/* Recibo de Despacho */}
      <DispatchReceiptModal
        open={!!dispatchReceipt}
        onClose={() => setDispatchReceipt(null)}
        invoice={dispatchReceipt}
      />

      {/* Orden de Almacén */}
      <WarehouseOrderModal
        open={!!warehouseOrderInvoice}
        onClose={() => setWarehouseOrderInvoice(null)}
        invoice={warehouseOrderInvoice}
        appName={appConfig?.app_name}
        onGenerated={(order) => {
          setWarehouseOrderInvoice(prev => (prev ? { ...prev, warehouse_order: order } : prev));
        }}
      />
    </div>
  );
}