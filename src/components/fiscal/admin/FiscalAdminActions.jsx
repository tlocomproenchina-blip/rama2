import React, { useState } from 'react';
import { BadgeCheck, CheckCircle2, FilePenLine, MessageSquareWarning, Pencil, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FiscalPdfButton from '@/components/fiscal/FiscalPdfButton';
import FiscalDecisionDialog from '@/components/fiscal/admin/FiscalDecisionDialog';

const DIALOGS = {
  approve: { title: 'Aprobar solicitud', description: 'Los datos fiscales quedan validados y lista para emisión.', required: false, confirmLabel: 'Aprobar solicitud', action: 'reviewRequest', ok: 'Solicitud aprobada' },
  correction: { title: 'Solicitar correcciones', description: 'Describe qué debe corregir el cliente. Verá este mensaje en su solicitud.', required: true, confirmLabel: 'Solicitar correcciones', action: 'reviewRequest', ok: 'Corrección solicitada' },
  reject: { title: 'Rechazar solicitud', description: 'Indica el motivo. La solicitud quedará cerrada.', required: true, confirmLabel: 'Rechazar solicitud', destructive: true, action: 'reviewRequest', ok: 'Solicitud rechazada' },
};

export default function FiscalAdminActions({ request, busy, onAct, onIssue, onEdit }) {
  const [dialog, setDialog] = useState(null);
  const s = request.status;
  const open = !['emitida', 'rechazada', 'borrador'].includes(s);
  const cfg = DIALOGS[dialog] || {};
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h3 className="font-display text-sm font-bold uppercase tracking-wide">Acciones administrativas</h3>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || s !== 'pendiente_revision_fiscal'} onClick={() => setDialog('approve')}><CheckCircle2 className="h-4 w-4" /> Aprobar solicitud</Button>
        <Button type="button" variant="outline" disabled={busy || s !== 'aprobada'} onClick={onIssue}><BadgeCheck className="h-4 w-4" /> Registrar emisión</Button>
        <Button type="button" variant="outline" disabled={busy || !open} onClick={() => setDialog('correction')}><MessageSquareWarning className="h-4 w-4" /> Solicitar correcciones</Button>
        <Button type="button" variant="outline" disabled={busy || !open} onClick={() => setDialog('reject')}><XCircle className="h-4 w-4" /> Rechazar</Button>
        <Button type="button" variant="outline" disabled={busy || ['emitida', 'rechazada'].includes(s)} onClick={onEdit}><Pencil className="h-4 w-4" /> Editar datos fiscales</Button>
        <FiscalPdfButton request={request} label="Generar PDF" size="default" />
      </div>
      {s === 'pendiente_revision_fiscal' || s === 'aprobada' ? null : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FilePenLine className="h-3.5 w-3.5" /> Aprobar requiere el pago del IVA verificado; registrar la emisión requiere la solicitud aprobada.</p>
      )}
      <FiscalDecisionDialog
        open={!!dialog}
        title={cfg.title}
        description={cfg.description}
        required={cfg.required}
        confirmLabel={cfg.confirmLabel}
        destructive={cfg.destructive}
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={async (notes) => {
          await onAct(cfg.action, { decision: dialog === 'approve' ? 'approve' : dialog === 'reject' ? 'reject' : 'request_correction', notes }, cfg.ok);
          setDialog(null);
        }}
      />
    </section>
  );
}