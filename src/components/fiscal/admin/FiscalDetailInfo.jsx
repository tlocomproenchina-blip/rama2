import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { money } from '@/lib/fiscalCalc';
import { fmtDate } from '@/lib/fiscalStatus';
import FiscalFileLink from '@/components/fiscal/FiscalFileLink';
import FiscalTotalsSummary from '@/components/fiscal/FiscalTotalsSummary';

const Item = ({ label, children, wide }) => (
  <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm font-medium">{children || '-'}</dd></div>
);

const Section = ({ title, children }) => (
  <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
    <h3 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">{title}</h3>
    {children}
  </section>
);

export default function FiscalDetailInfo({ request, invoice }) {
  const proofUrl = request.original_payment_proof || invoice?.payment_reference || '';
  const isUrl = /^https?:\/\//i.test(proofUrl);
  return (
    <div className="space-y-4">
      <Section title="Información del cliente">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Item label="Nombre">{request.client_name}</Item>
          <Item label="Correo electrónico">{request.client_email}</Item>
          <Item label="Shipping Mark"><span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-bold text-secondary-foreground">{request.shipping_mark || 'Sin mark'}</span></Item>
          <Item label="Factura original">
            <span className="inline-flex flex-wrap items-center gap-2">
              {request.invoice_number}
              {invoice ? <span className="text-xs font-normal text-muted-foreground">({invoice.status}, ${Number(invoice.total || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span> : null}
              <Link to="/AdminInvoices" className="inline-flex items-center gap-1 text-xs text-primary underline"><ExternalLink className="h-3 w-3" /> Ver facturas</Link>
            </span>
          </Item>
          <Item label="Comprobante de pago original" wide>
            {isUrl ? <FiscalFileLink uri={proofUrl} type={/\.pdf(\?|$)/i.test(proofUrl) ? 'pdf' : 'image'} label="Comprobante original" /> : 'Sin comprobante registrado'}
          </Item>
        </dl>
      </Section>
      <Section title="Información fiscal">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Item label="Razón social">{request.legal_name}</Item>
          <Item label="RIF">{request.rif}</Item>
          <Item label="Dirección fiscal" wide>{request.fiscal_address}</Item>
          <Item label="Documento RIF" wide><FiscalFileLink uri={request.rif_document_uri} type={request.rif_document_type} label="Documento RIF" filename={`rif-${request.request_number}`} /></Item>
        </dl>
      </Section>
      <Section title="Detalle económico">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Cant.</th><th className="px-3 py-2">Descripción</th><th className="px-3 py-2 text-right">Precio unit.</th><th className="px-3 py-2 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(request.lines || []).map((l, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{l.quantity}</td>
                  <td className="px-3 py-2">{l.description}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(l.unit_price)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FiscalTotalsSummary subtotal={request.subtotal} vat={request.vat_amount} total={request.total} />
        <p className="text-xs text-muted-foreground">Enviada: {request.submitted_date ? fmtDate(request.submitted_date) : 'aún no'}. Los importes fueron recalculados por el servidor.</p>
      </Section>
    </div>
  );
}