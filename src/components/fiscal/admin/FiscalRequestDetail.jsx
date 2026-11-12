import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fiscalCall } from '@/lib/fiscalApi';
import { invokeErrorMessage } from '@/lib/invokeErrorMessage';
import FiscalStatusBadge from '@/components/fiscal/FiscalStatusBadge';
import FiscalFileLink from '@/components/fiscal/FiscalFileLink';
import FiscalDetailInfo from '@/components/fiscal/admin/FiscalDetailInfo';
import FiscalVatVerification from '@/components/fiscal/admin/FiscalVatVerification';
import FiscalAdminActions from '@/components/fiscal/admin/FiscalAdminActions';
import FiscalAuditList from '@/components/fiscal/admin/FiscalAuditList';
import FiscalIssueDialog from '@/components/fiscal/admin/FiscalIssueDialog';
import FiscalAdminEditDialog from '@/components/fiscal/admin/FiscalAdminEditDialog';

export default function FiscalRequestDetail({ requestId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    const reqs = await base44.entities.FiscalInvoiceRequest.filter({ id: requestId });
    const request = reqs[0];
    const [proofs, audit, invs] = await Promise.all([
      base44.entities.FiscalVatProof.filter({ request_id: requestId }, '-created_date', 50),
      base44.entities.FiscalInvoiceAudit.filter({ request_id: requestId }, '-created_date', 200),
      request?.invoice_id ? base44.entities.Invoice.filter({ id: request.invoice_id }) : Promise.resolve([]),
    ]);
    setData({ request, proofs, audit, invoice: invs[0] || null });
  }, [requestId]);

  useEffect(() => { if (requestId) { setData(null); load(); } }, [requestId, load]);

  const act = async (action, payload, okMessage) => {
    setBusy(true);
    try {
      await fiscalCall(action, { id: requestId, ...payload });
      toast.success(okMessage);
      setDialog(null);
      await load();
      onChanged();
    } catch (err) {
      toast.error(invokeErrorMessage(err, 'No se pudo completar la acción'));
    } finally {
      setBusy(false);
    }
  };

  const r = data?.request;
  return (
    <Dialog open={!!requestId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            {r ? `Solicitud ${r.request_number}` : 'Solicitud'} {r ? <FiscalStatusBadge status={r.status} /> : null}
          </DialogTitle>
          <DialogDescription>Revisión de la solicitud de factura fiscal</DialogDescription>
        </DialogHeader>
        {!data ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !r ? (
          <p className="py-10 text-center text-sm text-muted-foreground">La solicitud ya no existe.</p>
        ) : (
          <div className="space-y-4">
            <FiscalDetailInfo request={r} invoice={data.invoice} />
            <FiscalVatVerification
              request={r}
              proofs={data.proofs}
              busy={busy}
              onDecision={(decision, notes) => act('reviewVat', { decision, notes }, decision === 'approve' ? 'Pago del IVA aprobado' : decision === 'reject' ? 'Comprobante rechazado' : 'Se mantiene en verificación')}
            />
            <FiscalAdminActions request={r} busy={busy} onAct={act} onIssue={() => setDialog('issue')} onEdit={() => setDialog('edit')} />
            {r.status === 'emitida' ? (
              <section className="space-y-2 rounded-2xl border border-green-200 bg-green-50 p-4">
                <h3 className="text-sm font-bold uppercase tracking-wide text-green-900">Factura fiscal emitida</h3>
                <p className="text-sm">N.º {r.issued_number} - {r.issued_date ? new Date(r.issued_date).toLocaleDateString('es-VE') : ''}</p>
                <FiscalFileLink uri={r.issued_document_uri} type={r.issued_document_type} label="Factura fiscal" filename={`factura-fiscal-${r.request_number}.pdf`} />
              </section>
            ) : null}
            <section className="space-y-3">
              <h3 className="font-display text-sm font-bold uppercase tracking-wide">Historial de cambios</h3>
              <FiscalAuditList audit={data.audit} />
            </section>
          </div>
        )}
        <FiscalIssueDialog open={dialog === 'issue'} request={r} busy={busy} onClose={() => setDialog(null)} onConfirm={(p) => act('issue', p, 'Emisión registrada')} />
        <FiscalAdminEditDialog open={dialog === 'edit'} request={r} busy={busy} onClose={() => setDialog(null)} onConfirm={(p) => act('adminEdit', p, 'Cambios guardados')} />
      </DialogContent>
    </Dialog>
  );
}