import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { money } from '@/lib/fiscalCalc';
import { STATUS_META, fmtDate } from '@/lib/fiscalStatus';
import FiscalStatusBadge from '@/components/fiscal/FiscalStatusBadge';
import FiscalFileLink from '@/components/fiscal/FiscalFileLink';
import FiscalPdfButton from '@/components/fiscal/FiscalPdfButton';
import FiscalTotalsSummary from '@/components/fiscal/FiscalTotalsSummary';

export const SUBMITTED_MESSAGE =
  '✅ Tu solicitud de factura fiscal y tu comprobante de pago del IVA fueron recibidos correctamente. Nuestro departamento de Finanzas verificará el pago para continuar con la emisión de tu factura fiscal.';

// Vista de solo lectura para el cliente (paso 4: confirmación y seguimiento).
export default function FiscalRequestStatusView({ request, justSubmitted }) {
  const meta = STATUS_META[request.status];
  const note = request.status === 'requiere_correccion' ? request.correction_notes : request.status === 'rechazada' ? request.rejection_reason : '';
  return (
    <div className="space-y-5">
      {justSubmitted ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{SUBMITTED_MESSAGE}</p>
          <p className="mt-2 text-sm font-extrabold uppercase">SU FACTURA FISCAL ESTARÁ DENTRO DE SU CARGA EN UN SOBRE COLOR MANILA</p>
        </div>
      ) : null}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-foreground">Estado de tu solicitud</h2>
            <FiscalStatusBadge status={request.status} />
          </div>
          <p className="text-sm text-muted-foreground">{meta?.hint}</p>
          {note ? (
            <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-orange-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-sm">{note}</p>
            </div>
          ) : null}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Razón social</dt><dd className="font-medium">{request.legal_name}</dd></div>
            <div><dt className="text-muted-foreground">RIF</dt><dd className="font-medium">{request.rif}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Dirección fiscal</dt><dd className="font-medium">{request.fiscal_address}</dd></div>
          </dl>
          <div className="divide-y divide-border rounded-xl border border-border">
            {(request.lines || []).map((l, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{l.quantity} x {l.description}</span>
                <span className="font-semibold tabular-nums">{money(l.total)}</span>
              </div>
            ))}
          </div>
          <FiscalTotalsSummary subtotal={request.subtotal} vat={request.vat_amount} total={request.total} />
          {request.status === 'emitida' ? (
            <div className="space-y-2 rounded-xl border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-semibold text-green-900">Factura fiscal emitida{request.issued_number ? ` - N.º ${request.issued_number}` : ''}{request.issued_date ? ` (${fmtDate(request.issued_date)})` : ''}</p>
              <FiscalFileLink uri={request.issued_document_uri} type={request.issued_document_type} label="Factura fiscal" filename={`factura-fiscal-${request.request_number}.pdf`} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <FiscalPdfButton request={request} label="Descargar PDF preliminar" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}