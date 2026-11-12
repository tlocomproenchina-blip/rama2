import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { CLIENT_EDITABLE } from '@/lib/fiscalStatus';
import FiscalStatusBadge from '@/components/fiscal/FiscalStatusBadge';
import FiscalStepper from '@/components/fiscal/FiscalStepper';
import FiscalWizard from '@/components/fiscal/FiscalWizard';
import FiscalRequestStatusView from '@/components/fiscal/FiscalRequestStatusView';

export default function FiscalInvoiceRequest({ user }) {
  const [params] = useSearchParams();
  const id = params.get('request');
  const [state, setState] = useState({ loading: true });
  const [justSubmitted, setJustSubmitted] = useState(false);

  const load = useCallback(async () => {
    const [reqs, methods, mine] = await Promise.all([
      base44.entities.FiscalInvoiceRequest.filter({ id }),
      base44.entities.FiscalVatPaymentMethod.filter({ active: true }, 'sort_order', 100),
      base44.entities.FiscalInvoiceRequest.filter({ client_email: user.email }, '-created_date', 30),
    ]);
    const previous = (mine || []).find((r) => r.id !== id && r.legal_name && r.rif && r.rif_document_uri) || null;
    setState({ loading: false, request: reqs[0] || null, methods: (methods || []).filter((m) => !m.archived), previous });
  }, [id, user.email]);

  useEffect(() => {
    if (id) load();
    else setState({ loading: false, request: null });
  }, [id, load]);

  const onChanged = (request, submitted) => {
    setState((s) => ({ ...s, request }));
    if (submitted) setJustSubmitted(true);
  };

  if (state.loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const { request, methods, previous } = state;
  if (!request) {
    return (
      <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
        <h1 className="font-display text-xl font-bold">No encontramos esta solicitud</h1>
        <p className="text-sm text-muted-foreground">Puede que no exista o que pertenezca a otra cuenta.</p>
        <Link to="/MyFiscalInvoices" className="text-sm font-semibold text-primary underline">Ir a Mis facturas fiscales</Link>
      </div>
    );
  }

  const editable = CLIENT_EDITABLE.includes(request.status);
  const notice = request.status === 'requiere_correccion' ? request.correction_notes : '';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/MyFiscalInvoices" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Mis facturas fiscales
      </Link>
      <div className="space-y-3 rounded-2xl border border-border bg-gradient-to-br from-accent via-card to-accent p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Solicitud de factura fiscal</h1>
          <FiscalStatusBadge status={request.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-white">Solicitud {request.request_number}</Badge>
          <Badge variant="outline" className="bg-white">Factura original {request.invoice_number || '-'}</Badge>
          {request.shipping_mark ? <Badge className="bg-secondary font-mono text-secondary-foreground">{request.shipping_mark}</Badge> : null}
        </div>
      </div>
      {notice ? <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900"><p className="font-semibold">Finanzas solicitó correcciones</p><p>{notice}</p></div> : null}
      {editable ? (
        <FiscalWizard request={request} methods={methods} previous={previous} onChanged={onChanged} />
      ) : (
        <div className="space-y-5">
          <FiscalStepper current={4} maxStep={0} />
          <FiscalRequestStatusView request={request} justSubmitted={justSubmitted} />
        </div>
      )}
    </div>
  );
}