import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import InvoiceCard from '@/components/invoice/InvoiceCard';
import PaymentModal from '@/components/PaymentModal';
import StripeCheckout from '@/components/payments/StripeCheckout';
import { FileText, Search, Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

export default function MyInvoices({ user }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedConsolidation, setSelectedConsolidation] = useState(null);
  const [stripeClientSecret, setStripeClientSecret] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeOpen, setStripeOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    const data = await base44.entities.Invoice.filter({ client_email: user.email }, '-invoice_date');
    setInvoices(data);
    setLoading(false);
  };

  const handlePayOnline = async (invoice) => {
    setProcessingPayment(true);
    try {
      // 1) Clave publicable de Stripe
      const cfg = await base44.functions.invoke('getStripeConfig');
      if (cfg.status !== 200 || !cfg.data?.publishableKey) {
        throw new Error('Stripe no está configurado correctamente');
      }
      setStripePublishableKey(cfg.data.publishableKey);

      // 2) Crear/reusar PaymentIntent para esta factura
      const res = await base44.functions.invoke('createStripePaymentIntent', { invoice_id: invoice.id });
      if (res.status !== 200 || !res.data?.client_secret) {
        throw new Error(res.data?.error || 'No se pudo iniciar el pago');
      }
      setStripeClientSecret(res.data.client_secret);
      setSelectedInvoice(invoice);
      setStripeOpen(true);
    } catch (error) {
      toast.error(error.message || 'No se pudo abrir Stripe');
      console.error(error);
    } finally {
      setProcessingPayment(false);
    }
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

  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.consolidation_tracking.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mis Facturas</h1>
          <p className="text-slate-500">Gestiona y descarga tus facturas</p>
        </div>
      </div>

      <Card className="border-0 shadow-lg">
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

      {filteredInvoices.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-slate-300 mb-4" />
            <p className="text-slate-500">No tienes facturas aún</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredInvoices.map(invoice => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              onPay={handlePayOnline}
              onDownload={handleDownloadPDF}
              showPayButton={true}
            />
          ))}
        </div>
      )}

      {processingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              <p className="text-slate-600">Procesando pago...</p>
            </div>
          </Card>
        </div>
      )}

      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        consolidation={selectedConsolidation}
        onPaymentSubmitted={() => {
          toast.success('Pago enviado para validación');
          setPaymentOpen(false);
          loadInvoices();
        }}
      />
    </div>
  );
}