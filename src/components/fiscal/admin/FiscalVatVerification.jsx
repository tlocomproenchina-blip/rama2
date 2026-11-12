import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/fiscalCalc';
import { fmtDate, fmtDateTime } from '@/lib/fiscalStatus';
import FiscalStatusBadge from '@/components/fiscal/FiscalStatusBadge';
import FiscalFileLink from '@/components/fiscal/FiscalFileLink';
import FiscalDecisionDialog from '@/components/fiscal/admin/FiscalDecisionDialog';

const Item = ({ label, children }) => (
  <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{children || '-'}</dd></div>
);

const DIALOGS = {
  approve: { title: 'Aprobar pago del IVA', description: 'Confirmas que recibiste el pago y que el importe corresponde. La solicitud pasará a Pendiente de revisión fiscal.', required: false, confirmLabel: 'Aprobar pago del IVA' },
  reject: { title: 'Rechazar comprobante', description: 'El cliente será notificado y podrá cargar un nuevo comprobante sin repetir el formulario.', required: true, confirmLabel: 'Rechazar comprobante', destructive: true },
  hold: { title: 'Mantener en verificación', description: 'La solicitud continúa pendiente hasta que confirmes la recepción del pago.', required: false, confirmLabel: 'Mantener en verificación' },
};

export default function FiscalVatVerification({ request, proofs, busy, onDecision }) {
  const [dialog, setDialog] = useState(null);
  const vp = request.vat_payment || {};
  const pending = vp.verification_status === 'en_verificacion';
  const underpaid = vp.amount_paid != null && Math.round(vp.amount_paid * 100) < Math.round(request.vat_amount * 100);

  return (
    <section className="space-y-4 rounded-2xl border-2 border-primary/50 bg-accent/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold uppercase tracking-wide">Verificación del pago del IVA</h3>
        <FiscalStatusBadge vat status={vp.verification_status || 'sin_comprobante'} />
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <Item label="Cliente">{request.client_name || request.client_email}</Item>
        <Item label="Shipping Mark">{request.shipping_mark}</Item>
        <Item label="Factura original">{request.invoice_number}</Item>
        <Item label="Razón social">{request.legal_name}</Item>
        <Item label="RIF">{request.rif}</Item>
        <Item label="Subtotal">{money(request.subtotal)}</Item>
        <Item label="IVA que corresponde pagar"><span className="font-bold text-primary">{money(request.vat_amount)}</span></Item>
        <Item label="Método seleccionado">{vp.method_name}</Item>
        <Item label="Monto declarado como pagado">{vp.amount_paid != null ? money(vp.amount_paid) : ''}</Item>
        <Item label="Referencia">{vp.reference}</Item>
        <Item label="Fecha del pago">{vp.payment_date ? fmtDate(vp.payment_date) : ''}</Item>
        {vp.verified_by ? <Item label="Verificado por">{vp.verified_by_name || vp.verified_by} - {fmtDateTime(vp.verified_date)}</Item> : null}
      </dl>
      {underpaid ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4" /> El monto declarado es menor al IVA de la solicitud.
        </div>
      ) : null}
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Comprobante del IVA</p>
        <FiscalFileLink uri={vp.proof_uri} type={vp.proof_type} label="Comprobante del IVA" filename={`comprobante-iva-${request.request_number}`} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!pending || busy} className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setDialog('approve')}><CheckCircle2 className="h-4 w-4" /> APROBAR PAGO DEL IVA</Button>
        <Button type="button" variant="destructive" disabled={!pending || busy} onClick={() => setDialog('reject')}><XCircle className="h-4 w-4" /> RECHAZAR COMPROBANTE</Button>
        <Button type="button" variant="outline" disabled={!pending || busy} onClick={() => setDialog('hold')}><Search className="h-4 w-4" /> MANTENER EN VERIFICACIÓN</Button>
      </div>
      {!pending ? <p className="text-xs text-muted-foreground">No hay un comprobante pendiente de verificación.</p> : null}

      {proofs.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historial de comprobantes</p>
          {proofs.map((p) => (
            <div key={p.id} className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{fmtDateTime(p.uploaded_date || p.created_date)} - Ref. {p.reference} - {money(p.amount)}</span>
                <FiscalStatusBadge vat status={p.status} />
              </div>
              {p.review_notes ? <p className="text-xs text-muted-foreground">{p.reviewed_by_name || p.reviewed_by}: {p.review_notes}</p> : null}
              <FiscalFileLink uri={p.file_uri} type={p.file_type} label="Comprobante" filename={`comprobante-iva-${request.request_number}`} />
            </div>
          ))}
        </div>
      ) : null}

      <FiscalDecisionDialog
        open={!!dialog}
        {...(DIALOGS[dialog] || {})}
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={async (notes) => { await onDecision(dialog, notes); setDialog(null); }}
      />
    </section>
  );
}