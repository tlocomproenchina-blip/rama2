import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';
import InvoicedReceiptRow from './InvoicedReceiptRow';

const fmtDate = (v) => {
  if (!v) return null;
  const d = new Date(String(v).includes('T') ? v : `${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-VE');
};

const STATUS_STYLES = {
  pendiente: 'bg-amber-100 text-amber-800 border-amber-300',
  pagada: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  vencida: 'bg-rose-100 text-rose-800 border-rose-300',
  cancelada: 'bg-slate-100 text-slate-600 border-slate-300',
  revision: 'bg-sky-100 text-sky-800 border-sky-300',
  sin_factura: 'bg-slate-100 text-slate-600 border-slate-300',
};

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  pagada: 'Pagada',
  vencida: 'Vencida',
  cancelada: 'Cancelada',
  revision: 'En revisión',
  sin_factura: 'Sin factura vigente',
};

// Los envíos ya facturados de un cliente, agrupados bajo la factura que los cobró
// (o bajo el aviso de que esa factura ya no existe), para revisarlos aquí mismo.
export default function InvoicedInvoiceGroup({ group }) {
  const statusKey = group.invoice_status || 'sin_factura';
  const statusStyle = STATUS_STYLES[statusKey] || STATUS_STYLES.sin_factura;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-foreground">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          {group.invoice_number || 'Sin factura vigente'}
        </span>
        <Badge className={`border ${statusStyle}`}>{STATUS_LABELS[statusKey] || statusKey}</Badge>
        {fmtDate(group.invoice_date) && (
          <span className="text-[11px] text-muted-foreground">{fmtDate(group.invoice_date)}</span>
        )}
        <span className="text-[11px] text-muted-foreground">{group.receipts.length} envío(s)</span>
        {group.invoice_number && (
          <span className="ml-auto font-mono text-xs font-semibold text-foreground">
            ${Number(group.invoice_total || 0).toFixed(2)}
          </span>
        )}
      </div>

      <div className="mt-2 space-y-2">
        {group.receipts.map((receipt) => (
          <InvoicedReceiptRow key={receipt.id} receipt={receipt} />
        ))}
      </div>
    </div>
  );
}