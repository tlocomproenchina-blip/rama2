import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { money } from '@/lib/fiscalCalc';
import { CLIENT_EDITABLE, STATUS_META, fmtDate } from '@/lib/fiscalStatus';
import FiscalStatusBadge from '@/components/fiscal/FiscalStatusBadge';
import FiscalPdfButton from '@/components/fiscal/FiscalPdfButton';
import FiscalFileLink from '@/components/fiscal/FiscalFileLink';

export default function FiscalRequestCard({ request }) {
  const editable = CLIENT_EDITABLE.includes(request.status);
  const actionLabel = request.status === 'comprobante_rechazado' ? 'Cargar nuevo comprobante' : request.status === 'requiere_correccion' ? 'Corregir solicitud' : 'Completar solicitud';
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-display text-base font-bold text-foreground">{request.request_number}</p>
            <p className="text-xs text-muted-foreground">Factura original {request.invoice_number || '-'} - {fmtDate(request.created_date)}</p>
          </div>
          <FiscalStatusBadge status={request.status} />
        </div>
        <p className="text-sm text-muted-foreground">{STATUS_META[request.status]?.hint}</p>
        {request.legal_name ? <p className="text-sm font-medium">{request.legal_name} - {request.rif}</p> : null}
        {request.total > 0 ? (
          <p className="text-sm text-muted-foreground">Total con IVA: <span className="font-bold text-foreground">{money(request.total)}</span> (IVA {money(request.vat_amount)})</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <Button asChild size="sm"><Link to={`/FiscalInvoiceRequest?request=${request.id}`}>{actionLabel} <ArrowRight className="h-4 w-4" /></Link></Button>
          ) : (
            <Button asChild size="sm" variant="outline"><Link to={`/FiscalInvoiceRequest?request=${request.id}`}>Ver detalle</Link></Button>
          )}
          {request.total > 0 ? <FiscalPdfButton request={request} label="PDF preliminar" /> : null}
        </div>
        {request.status === 'emitida' && request.issued_document_uri ? (
          <FiscalFileLink uri={request.issued_document_uri} type={request.issued_document_type} label="Factura fiscal" filename={`factura-fiscal-${request.request_number}.pdf`} />
        ) : null}
      </CardContent>
    </Card>
  );
}