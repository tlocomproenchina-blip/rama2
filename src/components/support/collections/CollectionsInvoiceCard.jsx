import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronDown, ChevronUp, DollarSign, Download, Loader2, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { buildInvoiceDoc } from '@/lib/invoicePdf';
import { invoiceBalance, invoiceClientName, OVERDUE_BUCKET_LABELS } from '@/lib/collections';
import CollectionsNotifyDialog from './CollectionsNotifyDialog';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-VE');
};

// Tarjeta de una factura por cobrar: días de vencida, saldo, detalle, CBM por
// contenedor, abonos y las acciones de PDF y notificación de pago.
export default function CollectionsInvoiceCard({ invoice, aging }) {
  const [showAbonos, setShowAbonos] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const abonos = Array.isArray(invoice.payment_history) ? invoice.payment_history : [];
  const recibos = Array.isArray(invoice.manual_recibos) ? invoice.manual_recibos : [];
  const balance = invoiceBalance(invoice);
  const overdue = aging.daysOverdue > 0;
  const visibleItems = items.slice(0, 4);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const doc = await buildInvoiceDoc(invoice);
      doc.save(`factura-${invoice.invoice_number || invoice.id}.pdf`);
    } catch (error) {
      toast.error('No se pudo generar el PDF de la factura');
    }
    setDownloading(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-slate-800">{invoice.invoice_number || 'Factura'}</p>
            <Badge className={overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
              {overdue ? OVERDUE_BUCKET_LABELS[aging.bucket] : 'Pendiente'}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
            Consolidación: {invoice.consolidation_tracking || '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${overdue ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
            {overdue ? `${aging.daysOverdue} días vencida` : `${aging.daysLeft} días p/ vencer`}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        {invoice.shipping_mark && (
          <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px]">
            {invoice.shipping_mark}
          </span>
        )}
        <span className="font-medium text-slate-700">{invoiceClientName(invoice)}</span>
        {invoice.client_whatsapp && (
          <span className="flex items-center gap-1 text-slate-500">
            <Phone className="h-3 w-3" />
            {invoice.client_whatsapp}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatDate(invoice.invoice_date)}
        </span>
        <span className="flex items-center gap-1 font-semibold text-slate-800">
          <DollarSign className="h-3 w-3" />
          {money(balance)}
        </span>
        <span className="text-slate-400">Total {money(invoice.total)}</span>
      </div>

      {visibleItems.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-xs">
          {visibleItems.map((item, index) => (
            <div key={`${item.description}-${index}`} className="flex items-start justify-between gap-3">
              <span className="line-clamp-2 text-slate-600">{item.description || 'Concepto'}</span>
              <span className="shrink-0 font-medium text-slate-700">{money(item.total)}</span>
            </div>
          ))}
          {items.length > visibleItems.length && (
            <p className="text-[11px] text-slate-400">+ {items.length - visibleItems.length} concepto(s) más</p>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-sm">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="font-bold text-slate-900">{money(invoice.total)}</span>
          </div>
        </div>
      )}

      {recibos.length > 0 && (
        <div className="mt-3 rounded-lg bg-slate-50 p-2.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <span>CBM por contenedor</span>
            <span>Total CBM</span>
          </div>
          <div className="mt-1 space-y-0.5 text-xs">
            {recibos.map((recibo, index) => (
              <div key={recibo.cbm_ingreso_id || index} className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-600">Contenedor {recibo.invoice_number || '—'}</span>
                <span className="shrink-0 text-slate-700">{Number(recibo.cbm || 0).toFixed(4)} CBM</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAbonos((value) => !value)}
        className="mt-3 flex w-full items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
      >
        <span>Ver abonos ({abonos.length})</span>
        {showAbonos ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {showAbonos && (
        <div className="mt-1 space-y-1 text-xs">
          {abonos.length === 0 ? (
            <p className="text-slate-400">Sin abonos registrados.</p>
          ) : (
            abonos.map((abono, index) => (
              <div key={abono.charge_id || index} className="flex items-center justify-between gap-2 text-slate-600">
                <span>
                  {formatDate(abono.date)}
                  {abono.method_brand ? ` · ${abono.method_brand}${abono.last4 ? ` ${abono.last4}` : ''}` : ''}
                </span>
                <span className="font-medium text-emerald-700">{money(abono.amount_paid)}</span>
              </div>
            ))
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloading} className="flex-1 sm:flex-none">
          {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Descargar PDF
        </Button>
        <Button size="sm" onClick={() => setNotifyOpen(true)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 sm:flex-none">
          <MessageCircle className="mr-2 h-4 w-4" />
          Notificar pago
        </Button>
      </div>

      <CollectionsNotifyDialog
        invoice={invoice}
        aging={aging}
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
      />
    </div>
  );
}