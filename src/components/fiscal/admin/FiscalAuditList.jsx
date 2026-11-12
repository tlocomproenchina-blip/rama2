import React from 'react';
import { money } from '@/lib/fiscalCalc';
import { STATUS_META, fmtDateTime } from '@/lib/fiscalStatus';

const ACTIONS = {
  intent: 'Solicitud iniciada',
  save_draft: 'Borrador guardado',
  submit: 'Solicitud enviada',
  vat_approved: 'Pago del IVA aprobado',
  vat_rejected: 'Comprobante rechazado',
  vat_hold: 'Mantenido en verificación',
  request_approved: 'Solicitud aprobada',
  request_rejected: 'Solicitud rechazada',
  correction_requested: 'Corrección solicitada',
  admin_edit: 'Edición administrativa',
  issued: 'Factura fiscal emitida',
};

export default function FiscalAuditList({ audit }) {
  if (!audit.length) return <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>;
  return (
    <ol className="space-y-3">
      {audit.map((a) => (
        <li key={a.id} className="rounded-xl border border-border bg-card p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{ACTIONS[a.action] || a.action}</span>
            <span className="text-xs text-muted-foreground">{fmtDateTime(a.created_date)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {a.actor_name || a.actor_email} ({a.actor_type})
            {a.from_status && a.to_status && a.from_status !== a.to_status ? ` - ${STATUS_META[a.from_status]?.label || a.from_status} → ${STATUS_META[a.to_status]?.label || a.to_status}` : ''}
          </p>
          {a.changes?.total ? (
            <p className="mt-1 text-xs">Importes: total {money(a.changes.total.before)} → {money(a.changes.total.after)}; IVA {money(a.changes.vat_amount?.before)} → {money(a.changes.vat_amount?.after)}</p>
          ) : null}
          {a.notes ? <p className="mt-1 text-sm">{a.notes}</p> : null}
        </li>
      ))}
    </ol>
  );
}