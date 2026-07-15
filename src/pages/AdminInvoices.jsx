import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { fetchAllPaginated } from '@/lib/fetchAllPaginated';
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
import { FileText, Search, Loader2, Download, DollarSign, TrendingUp, Plus, Edit, Trash2, PackageX, MessageCircle, Truck } from 'lucide-react';
import { buildWhatsAppUrl } from '@/lib/whatsappContact';
import { toast } from 'sonner';

export default function AdminInvoices({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    revenue: 0,
    profit: 0
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
  const [appConfig, setAppConfig] = useState(null);
  const [dispatchReceipt, setDispatchReceipt] = useState(null);

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

  const computeStats = (list) => {
    let paid = 0, pending = 0, revenue = 0, profit = 0;
    for (const i of list) {
      if (i.status === 'pagada') { paid++; revenue += Number(i.total) || 0; }
      else if (i.status === 'pendiente') pending++;
      if (i.profit_amount !== undefined && i.profit_amount !== null) profit += Number(i.profit_amount) || 0;
    }
    setStats({ total: list.length, paid, pending, revenue, profit });
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

  const loadInvoices = async (append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    const skip = append ? invoices.length : 0;
    const data = await base44.entities.Invoice.list('-invoice_date', pageSize, skip);

    // FASE 1: mostrar las facturas de inmediato (sin esperar los datos del cliente)
    const baseList = append ? [...invoices, ...(data || [])] : (data || []);
    setInvoices(baseList);
    computeStats(baseList);
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

  const handleEditInvoice = async () => {
    if (!editingInvoice) return;

    setProcessing(true);
    try {
      const updatePayload = {
        status: editingInvoice.status,
        notes: editingInvoice.notes,
      };
      if (editingInvoice.payment_method) updatePayload.payment_method = editingInvoice.payment_method;
      if (editingInvoice.payment_reference) updatePayload.payment_reference = editingInvoice.payment_reference;
      if (editingInvoice.status === 'pagada' && !editingInvoice.payment_date) updatePayload.payment_date = new Date().toISOString();
      await base44.entities.Invoice.update(editingInvoice.id, updatePayload);

      // Stripe sync behavior (configurable)
      if (editingInvoice.status === 'pagada') {
        const cfgs = await base44.entities.AppConfig.filter({ config_key: 'main' });
        const cfg = cfgs?.[0] || {};
        const mode = cfg.payments_stripe_sync_mode || 'auto';
        const errMode = cfg.payments_stripe_error_mode || 'keep_and_alert';

        const shouldInvoke = mode === 'auto' || (mode === 'confirm' && window.confirm('¿También notificar a Stripe como pagada?'));
        if (shouldInvoke) {
          try {
            const res = await base44.functions.invoke('markStripeInvoicePaid', { invoiceId: editingInvoice.id });
            if (res?.data && res.data.ok === false) {
              if (errMode === 'revert' || errMode === 'retry_then_revert') {
                await base44.entities.Invoice.update(editingInvoice.id, { status: 'pendiente' });
                toast.error('Stripe no se actualizó; se revirtió la factura a pendiente.');
              } else {
                toast.warning('Se marcó pagada en la app, pero Stripe no se actualizó.');
              }
            }
          } catch (e) {
            if (errMode === 'revert' || errMode === 'retry_then_revert') {
              await base44.entities.Invoice.update(editingInvoice.id, { status: 'pendiente' });
              toast.error('Stripe no se actualizó; se revirtió la factura a pendiente.');
            } else {
              toast.warning('Se marcó pagada en la app, pero Stripe no se actualizó.');
            }
          }
        } else if (mode === 'button') {
          toast.info('Modo botón: usa "Marcar pagada en Stripe" en las acciones de la factura.');
        }
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
      const selectedInvs = invoices.filter(i => selectedInvoices.includes(i.id));

      if (bulkAction === 'delete') {
        await Promise.all(selectedInvs.map(inv => releaseBilledCbm(inv.id)));
        await Promise.all(selectedInvs.map(inv => 
          base44.entities.Invoice.delete(inv.id)
        ));
        toast.success(`${selectedInvoices.length} factura(s) eliminada(s)`);
      } else if (bulkAction === 'status') {
        await Promise.all(selectedInvs.map(inv => 
          base44.entities.Invoice.update(inv.id, { status: bulkStatus })
        ));

        if (bulkStatus === 'pagada') {
          const cfgs = await base44.entities.AppConfig.filter({ config_key: 'main' });
          const cfg = cfgs?.[0] || {};
          const mode = cfg.payments_stripe_sync_mode || 'auto';
          const errMode = cfg.payments_stripe_error_mode || 'keep_and_alert';

          const proceed = mode === 'auto' || (mode === 'confirm' && window.confirm('¿También notificar a Stripe las facturas seleccionadas como pagadas?'));
          if (proceed) {
            const results = await Promise.allSettled(
              selectedInvs.map(inv => base44.functions.invoke('markStripeInvoicePaid', { invoiceId: inv.id }))
            );
            const failedIds = results.map((r, idx) => ({ r, id: selectedInvs[idx].id }))
              .filter(x => x.r.status === 'rejected' || (x.r.status === 'fulfilled' && x.r.r?.data && x.r.r.data.ok === false))
              .map(x => x.id);
            if ((errMode === 'revert' || errMode === 'retry_then_revert') && failedIds.length) {
              await Promise.all(failedIds.map(id => base44.entities.Invoice.update(id, { status: 'pendiente' })));
              toast.error(`Stripe no se actualizó para ${failedIds.length} factura(s); se revirtieron a pendiente.`);
            } else if (failedIds.length) {
              toast.warning(`Stripe no se actualizó para ${failedIds.length} factura(s).`);
            }
          } else if (mode === 'button') {
            toast.info('Modo botón: usa la acción "Marcar en Stripe" por factura.');
          }
        }

        toast.success(`${selectedInvoices.length} factura(s) actualizada(s)`);
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
    const message = `Hola ${name}, le contactamos de TLEC CARGO. Tiene una factura pendiente de pago (${invoice.invoice_number || ''}) por un monto de $${Number(invoice.total || 0).toFixed(2)}. Agradecemos su pago a la brevedad para poder realizar el despacho de su carga. ¡Gracias!`;
    const url = buildWhatsAppUrl(phone, message);
    if (!url) {
      toast.error('Este cliente no tiene número de WhatsApp registrado');
      return;
    }
    window.open(url, '_blank');
  };

  // Guarda manualmente cuánto se pagó al proveedor, recalcula la ganancia
  // y sincroniza/crea la Cuenta por Pagar asociada a la consolidación.
  const handleSaveProviderCost = async (invoice, cost) => {
    try {
      const profit = Number(invoice.total || 0) - Number(cost || 0);
      await base44.entities.Invoice.update(invoice.id, {
        provider_cost_total: Number(cost),
        profit_amount: profit
      });

      // Sincronizar Cuentas por Pagar: actualizar el monto original a pagar.
      if (invoice.consolidation_id) {
        const aps = await base44.entities.AccountsPayable.filter({ related_consolidation_id: invoice.consolidation_id }).catch(() => []);
        if (aps && aps.length > 0) {
          await Promise.all(aps.map(ap => base44.entities.AccountsPayable.update(ap.id, {
            original_amount_due: Number(cost),
            balance_due: ap.status === 'pagado' ? 0 : Number(cost),
            amount_paid: ap.status === 'pagado' ? Number(cost) : Number(ap.amount_paid || 0)
          })));
        } else {
          // No existe AP aún: crear una para mantener Cuentas por Pagar al día.
          await base44.entities.AccountsPayable.create({
            vendor_name: 'Proveedor logístico',
            description: `Costo proveedor factura ${invoice.invoice_number || ''}`.trim(),
            original_amount_due: Number(cost),
            balance_due: invoice.provider_paid ? 0 : Number(cost),
            amount_paid: invoice.provider_paid ? Number(cost) : 0,
            status: invoice.provider_paid ? 'pagado' : 'pendiente',
            related_consolidation_id: invoice.consolidation_id
          });
        }
      }

      setInvoices(prev => prev.map(i => i.id === invoice.id ? { ...i, provider_cost_total: Number(cost), profit_amount: profit } : i));
      setStats(prev => {
        const oldProfit = (invoice.profit_amount != null) ? Number(invoice.profit_amount) : 0;
        return { ...prev, profit: Number(prev.profit || 0) - oldProfit + profit };
      });
      toast.success('Costo del proveedor y ganancia actualizados');
    } catch (error) {
      toast.error('Error al guardar el costo del proveedor');
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

  const filteredInvoices = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter(inv => {
      const matchesSearch = !q || (
        (inv.invoice_number || '').toLowerCase().includes(q) ||
        (inv.client_email || '').toLowerCase().includes(q) ||
        (inv.consolidation_tracking || '').toLowerCase().includes(q)
      );
      const matchesStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'provider_unpaid' ? (inv.status === 'pagada' && !inv.provider_paid) :
        inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

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
          <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Crear Factura
          </Button>
          <Button onClick={handleExportAll} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => setShowPaymentsSettings(true)}>
            Métodos de Pago
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Facturas</p>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pagadas</p>
                <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <FileText className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ingresos</p>
                <p className="text-2xl font-bold text-emerald-600">${Number(stats.revenue || 0).toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ganancia</p>
                <p className="text-2xl font-bold text-purple-600">${Number(stats.profit || 0).toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número, cliente o tracking..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
          <TabsTrigger value="pagada">Pagadas</TabsTrigger>
          <TabsTrigger value="vencida">Vencidas</TabsTrigger>
          <TabsTrigger value="provider_unpaid">No pagadas al proveedor</TabsTrigger>
        </TabsList>
      </Tabs>

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
            <div key={invoice.id} className="flex flex-col lg:flex-row gap-3 items-stretch">
              <div className="flex-1 min-w-0">
                <InvoiceCard
                  invoice={invoice}
                  onDownload={handleDownloadPDF}
                  showPayButton={false}
                  showInsuranceBreakdown={true}
                  selectionControl={(
                    <Checkbox 
                      checked={selectedInvoices.includes(invoice.id)}
                      onCheckedChange={(checked) => handleSelectInvoice(invoice.id, checked)}
                      className="bg-white"
                    />
                  )}
                  extraActions={(
                    <div className="w-full space-y-3">
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
              <div className="flex flex-row flex-wrap lg:flex-col gap-2 lg:w-44 shrink-0 items-stretch content-start">
                {invoice.profit_amount != null && (
                  <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-full text-center whitespace-nowrap ${Number(invoice.profit_amount) >= 0 ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}`}>
                    Ganancia: ${Number(invoice.profit_amount).toFixed(2)}
                  </span>
                )}
                {invoice.provider_paid && (
                  <span className="text-xs font-semibold px-2.5 py-1.5 rounded-full text-center whitespace-nowrap bg-emerald-100 text-emerald-700">
                    ✓ Pagado al proveedor
                  </span>
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
                {invoice.status === 'pagada' && (invoice.stripe_invoice_id || invoice.stripe_hosted_invoice_url) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={async () => {
                      const res = await base44.functions.invoke('markStripeInvoicePaid', { invoiceId: invoice.id });
                      if (res?.data?.ok) toast.success('Stripe actualizado');
                      else if (res?.data?.skipped) toast.info('No hay factura de Stripe vinculada para esta factura.');
                      else toast.warning('No se pudo actualizar Stripe');
                    }}
                  >
                    Forzar pagada en Stripe
                  </Button>
                )}
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

        {hasMore && (
          <Button variant="outline" className="w-full mt-4" onClick={() => loadInvoices(true)} disabled={loadingMore}>
            {loadingMore ? 'Cargando...' : 'Cargar más'}
          </Button>
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
                    <SelectItem value="stripe_invoice">Stripe (tarjeta)</SelectItem>
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

      {/* Recibo de Despacho */}
      <DispatchReceiptModal
        open={!!dispatchReceipt}
        onClose={() => setDispatchReceipt(null)}
        invoice={dispatchReceipt}
      />
    </div>
  );
}