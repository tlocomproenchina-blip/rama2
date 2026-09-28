import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import InvoiceCard from '@/components/invoice/InvoiceCard';
import AbonoModal from '@/components/invoice/AbonoModal';
import useEntitySubscription from '@/hooks/useEntitySubscription';
import { createPageUrl } from '@/utils';
import PayPalInline from '@/components/payments/PayPalInline';
import PaymentModal from '@/components/PaymentModal';
import { FileText, Search, Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import PortalMetricCard from '@/components/client-portal/PortalMetricCard';
import ClientSectionHeader from '@/components/client-portal/ClientSectionHeader';
import CreditBalanceWidget from '@/components/client-portal/CreditBalanceWidget';

export default function MyInvoices({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedConsolidation, setSelectedConsolidation] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [config, setConfig] = useState(null);
  const [paypalOpen, setPaypalOpen] = useState(false);
  const [abonoOpen, setAbonoOpen] = useState(false);
  const [abonoInvoice, setAbonoInvoice] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const PAGE_SIZE = 100;
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    // Factura a resaltar desde la URL (?invoice=<id>) — viene de "Ir a pagar"
    const urlParams = new URLSearchParams(window.location.search);
    const invId = urlParams.get('invoice');
    if (invId) setHighlightId(invId);

    // Cargar facturas y config en paralelo
    Promise.all([
      base44.entities.Invoice.filter({ client_email: user.email }, '-invoice_date', PAGE_SIZE, 0),
      base44.entities.AppConfig.filter({ config_key: 'main' })
    ]).then(async ([data, cfgs]) => {
      setInvoices(data);
      setHasMore(data.length === PAGE_SIZE);
      setConfig(cfgs[0] || null);
      setLoading(false);

      // Auto-aplicar saldo a favor si hay facturas pendientes
      const hasPending = data.some((inv) => inv.status === 'pendiente' || inv.status === 'revision');
      if (hasPending) {
        try {
          const creditRes = await base44.functions.invoke('applyClientCreditToInvoice', { client_email: user.email });
          const applied = creditRes?.data?.applied || [];
          if (applied.length > 0) {
            const msg = applied.map(a => `Factura ${a.invoice_number}: -$${Number(a.applied).toFixed(2)}${a.fully_paid ? ' (pagada)' : ''}`).join(', ');
            toast.success(`Saldo a favor aplicado automáticamente: ${msg}`, { duration: 8000 });
            // Recargar facturas para reflejar los nuevos paid_amount/status
            const refreshed = await base44.entities.Invoice.filter({ client_email: user.email }, '-invoice_date', PAGE_SIZE, 0);
            setInvoices(refreshed);
          }
        } catch { /* silencioso */ }
      }
    });

  }, []);

  // Tiempo real: refrescar facturas cuando cambian (abono aprobado, estado, etc.)
  useEntitySubscription('Invoice', () => {
    loadInvoices();
  });
  useEntitySubscription('InvoicePayment', () => {
    loadInvoices();
  });

  const loadInvoices = async (append = false) => {
    const skip = append ? invoices.length : 0;
    if (append) setLoadingMore(true); else setLoading(true);
    const data = await base44.entities.Invoice.filter({ client_email: user.email }, '-invoice_date', PAGE_SIZE, skip);
    if (append) {
      setInvoices(prev => [...prev, ...data]);
    } else {
      setInvoices(data);
    }
    setHasMore(data.length === PAGE_SIZE);
    if (append) setLoadingMore(false); else setLoading(false);
  };

  const handlePayPal = async (invoice) => {
    setSelectedInvoice(invoice);
    setPaypalOpen(true);
  };

   const handleDownloadPDF = (invoice) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('TLEC Logistics', 20, 20);
    doc.setFontSize(10);
    doc.text('Sistema de Envíos Internacionales', 20, 27);
    
    // Invoice info
    doc.setFontSize(16);
    doc.text('FACTURA', 150, 20);
    doc.setFontSize(10);
    doc.text(`No: ${invoice.invoice_number}`, 150, 27);
    doc.text(`Fecha: ${new Date(invoice.invoice_date).toLocaleDateString()}`, 150, 33);
    
    // Client info
    doc.setFontSize(12);
    doc.text('Cliente:', 20, 50);
    doc.setFontSize(10);
    doc.text(user.full_name || user.email, 20, 57);
    doc.text(invoice.client_email, 20, 63);
    
    // Items
    let yPos = 80;
    doc.setFontSize(12);
    doc.text('Concepto', 20, yPos);
    doc.text('Total', 170, yPos);
    yPos += 5;
    doc.line(20, yPos, 190, yPos);
    yPos += 7;
    
    doc.setFontSize(10);
    invoice.items?.forEach(item => {
      doc.text(item.description, 20, yPos);
      doc.text(`$${item.total.toFixed(2)}`, 170, yPos);
      yPos += 7;
    });
    
    // Total
    yPos += 5;
    doc.line(20, yPos, 190, yPos);
    yPos += 7;
    doc.setFontSize(12);
    doc.text('TOTAL:', 130, yPos);
    doc.text(`$${invoice.total.toFixed(2)}`, 170, yPos);
    
    // Status
    yPos += 10;
    doc.setFontSize(10);
    doc.text(`Estado: ${invoice.status.toUpperCase()}`, 20, yPos);
    
    if (invoice.payment_date) {
      yPos += 7;
      doc.text(`Pagado: ${new Date(invoice.payment_date).toLocaleDateString()}`, 20, yPos);
    }
    
    doc.save(`factura-${invoice.invoice_number}.pdf`);
    toast.success('Factura descargada');
  };

  const filteredInvoices = useMemo(() => {
    const term = String(search || '').toLowerCase();
    if (!term) return invoices;
    return invoices.filter((inv) => {
      const invoiceNumber = String(inv.invoice_number || '').toLowerCase();
      const consolidationTracking = String(inv.consolidation_tracking || '').toLowerCase();
      return invoiceNumber.includes(term) || consolidationTracking.includes(term);
    });
  }, [invoices, search]);

  // Calcular stats en un solo recorrido
  const invoiceStats = useMemo(() => {
    const stats = { total: invoices.length, pendientes: 0, revision: 0, pagadas: 0 };
    for (const inv of invoices) {
      if (inv.status === 'pendiente') stats.pendientes++;
      else if (inv.status === 'revision') stats.revision++;
      else if (inv.status === 'pagada') stats.pagadas++;
    }
    return stats;
  }, [invoices]);

  // Mostrar facturas "pendiente" solo si hay métodos de pago habilitados
  const hasOtherMethodsConfigured = useMemo(() => {
    const c = config || {};
    return (
      (c.payments_enable_binance === true && c.wallet_binance) ||
      (c.payments_enable_usdt_trc20 === true && c.wallet_usdt_trc20) ||
      (c.payments_enable_paypal === true && c.wallet_paypal) ||
      (c.payments_enable_wally === true && c.wallet_wally) ||
      (c.payments_enable_zinli === true && c.wallet_zinli) ||
      (c.payments_enable_wise === true && c.wallet_wise) ||
      (c.payments_enable_skrill === true && c.wallet_skrill) ||
      (c.payments_enable_pago_movil_usdt === true && c.wallet_pago_movil_usdt)
    );
  }, [config]);

  const visibleInvoices = useMemo(() => filteredInvoices.filter(inv => {
    if (inv.status !== 'pendiente') return true;
    return hasOtherMethodsConfigured;
  }), [filteredInvoices, hasOtherMethodsConfigured]);

  // Scroll automático a la factura resaltada (viene de "Ir a pagar")
  useEffect(() => {
    if (!highlightId || loading) return;
    const el = document.getElementById(`invoice-${highlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightId(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [highlightId, loading, visibleInvoices]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <ClientPageHero
        icon={FileText}
        eyebrow="Finanzas y ayuda"
        title="Mis Facturas"
        description="Gestiona, busca y descarga tus facturas con una vista más clara y premium."
        badges={[`${visibleInvoices.length} visibles`, hasOtherMethodsConfigured ? 'Pago disponible' : 'Pago en configuración']}
        aside={
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Resumen financiero</p>
            <div className="rounded-2xl bg-slate-100/90 px-3 py-2 text-sm font-semibold text-slate-700">
              {invoiceStats.pendientes} pendiente(s) de pago
            </div>
            <p className="text-sm text-muted-foreground">Busca por número de factura o tracking para ubicar más rápido cada documento.</p>
          </div>
        }
      />

      <CreditBalanceWidget user={user} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PortalMetricCard title="Total" value={invoiceStats.total} subtitle="Facturas registradas" icon={FileText} tone="blue" />
        <PortalMetricCard title="Pendientes" value={invoiceStats.pendientes} subtitle="Esperando pago" icon={CreditCard} tone="amber" />
        <PortalMetricCard title="En revisión" value={invoiceStats.revision} subtitle="Pagos por validar" icon={Loader2} tone="violet" />
        <PortalMetricCard title="Pagadas" value={invoiceStats.pagadas} subtitle="Documentos completados" icon={FileText} tone="blue" />
      </div>

      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número de factura o tracking..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {visibleInvoices.length === 0 ? (
        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-slate-300 mb-4" />
            <p className="text-slate-500">No tienes facturas aún</p>
            <p className="text-slate-400 text-sm mt-2">Si recién generaste una consolidación, la factura puede tardar ~15s en aparecer.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ClientSectionHeader
            title="Facturas disponibles"
            description="Revisa cada factura, descarga su PDF o continúa con el pago correspondiente."
          />
          <div className="grid gap-4">
            {visibleInvoices.map((invoice) => (
              <div
                id={`invoice-${invoice.id}`}
                key={invoice.id}
                className={`transition-all duration-700 rounded-2xl ${highlightId === invoice.id ? 'ring-4 ring-blue-400 ring-offset-2 ring-offset-background scale-[1.01]' : ''}`}
              >
              <InvoiceCard
                invoice={invoice}
                user={user}
                onDownload={handleDownloadPDF}
                onPayPal={handlePayPal}
                showPayPalButton={config?.payments_enable_paypal === true}
                onAbono={(inv) => {
                  if (inv.status === 'pagada' || inv.status === 'revision') return;
                  setAbonoInvoice(inv);
                  setAbonoOpen(true);
                }}
                showAbonoButton={hasOtherMethodsConfigured}
                onRefresh={loadInvoices}
                onOtherPay={(inv) => {
                  if (inv.status === 'pagada' || inv.status === 'revision') return;
                  const balance = Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0));
                  setSelectedConsolidation({ id: inv.consolidation_id, invoice_id: inv.id, total_cost: balance, consolidation_tracking: inv.consolidation_tracking });
                  setPaymentOpen(true);
                }}
                showOtherMethodsButton={hasOtherMethodsConfigured}
              />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal PayPal */}
      {paypalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow p-5">
            <PayPalInline 
              invoice={selectedInvoice}
              onSuccess={async () => {
                setPaypalOpen(false);
                await loadInvoices();
              }}
              onClose={() => setPaypalOpen(false)}
            />
          </div>
        </div>
      )}

       {/* Modal de Abono (pago parcial) */}
       <AbonoModal
         open={abonoOpen}
         onClose={() => setAbonoOpen(false)}
         invoice={abonoInvoice}
         onSubmitted={async () => {
           setAbonoOpen(false);
           await loadInvoices();
         }}
       />

        {/* Modal antiguo de pago sigue disponible para otros métodos */}
        <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        consolidation={selectedConsolidation}
        onPaymentSubmitted={() => {
          toast.success('Pago enviado para validación');
          setPaymentOpen(false);
          // Actualización en vivo: marcar la factura como "revision" de inmediato
          const invId = selectedConsolidation?.invoice_id;
          const consId = selectedConsolidation?.id;
          setInvoices(prev => prev.map(inv => {
            const matches = (invId && inv.id === invId) || (!invId && consId && inv.consolidation_id === consId);
            return (matches && inv.status === 'pendiente') ? { ...inv, status: 'revision' } : inv;
          }));
        }}
      />
    </div>
  );
}