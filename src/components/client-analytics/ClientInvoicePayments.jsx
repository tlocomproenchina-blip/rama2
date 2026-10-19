import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Eye, Plus, Wallet, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import useFileViewer from '@/hooks/useFileViewer';
import { METHOD_LABELS } from '@/lib/abonoMethods';
import AdminAbonoModal from '@/components/client-analytics/AdminAbonoModal';

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) => `$${num(value).toFixed(2)}`;

const STATUS = {
  pendiente: { label: 'Pendiente', icon: Clock, cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  aprobado: { label: 'Aprobado', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rechazado: { label: 'Rechazado', icon: XCircle, cls: 'bg-rose-100 text-rose-700 border-rose-200' },
};

const paymentDate = (payment) => payment?.reported_date || payment?.created_date;

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  } catch {
    return '—';
  }
};

// Abonos y pagos que el cliente registró en una factura, con lo ya abonado y el
// saldo que queda. Desde aquí el administrador registra un abono sobre esa factura;
// la revisión de los abonos que reporta el cliente sigue en el módulo de pagos.
export default function ClientInvoicePayments({ invoice, payments, onSaved }) {
  const fileViewer = useFileViewer();
  const [abonoOpen, setAbonoOpen] = useState(false);
  const list = [...(payments || [])].sort(
    (a, b) => new Date(paymentDate(b) || 0).getTime() - new Date(paymentDate(a) || 0).getTime()
  );

  const sumBy = (status) => list.filter((p) => p.status === status).reduce((sum, p) => sum + num(p.amount), 0);
  const approved = sumBy('aprobado');
  const pending = sumBy('pendiente');
  const rejected = sumBy('rechazado');
  const balance = Math.max(num(invoice?.total) - approved, 0);
  // Solo se puede abonar mientras la factura tenga saldo y siga activa.
  const canAbonar = balance > 0.01 && !['cancelada', 'pagada'].includes(invoice?.status);

  const chips = [
    { label: `Abonado ${money(approved)}`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    pending > 0 && { label: `Por validar ${money(pending)}`, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    rejected > 0 && { label: `Rechazado ${money(rejected)}`, cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    { label: `Saldo ${money(balance)}`, cls: balance > 0 ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-semibold text-slate-600">
          <Wallet className="h-3.5 w-3.5" /> Abonos / pagos del cliente ({list.length})
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span key={chip.label} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}>
              {chip.label}
            </span>
          ))}
          {canAbonar ? (
            <Button
              size="sm"
              className="h-7 gap-1.5 bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-700"
              onClick={() => setAbonoOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Registrar abono
            </Button>
          ) : null}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">Este cliente no ha registrado abonos en esta factura.</p>
      ) : (
        <div className="space-y-2">
          {list.map((payment) => {
            const cfg = STATUS[payment.status] || STATUS.pendiente;
            const StatusIcon = cfg.icon;
            return (
              <div key={payment.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">{money(payment.amount)}</span>
                      <Badge variant="outline" className={`${cfg.cls} gap-1`}>
                        <StatusIcon className="h-3 w-3" /> {cfg.label}
                      </Badge>
                      <span className="text-xs text-slate-600">{METHOD_LABELS[payment.method] || payment.method || '—'}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(paymentDate(payment))}
                      {payment.reference ? ` · Ref: ${payment.reference}` : ''}
                    </p>
                    {payment.status === 'aprobado' && payment.approved_date ? (
                      <p className="mt-1 text-xs text-emerald-600">
                        Aprobado: {formatDate(payment.approved_date)}{payment.approved_by ? ` por ${payment.approved_by}` : ''}
                      </p>
                    ) : null}
                    {payment.status === 'rechazado' && payment.reject_reason ? (
                      <p className="mt-1 text-xs text-rose-600">Motivo: {payment.reject_reason}</p>
                    ) : null}
                  </div>

                  {payment.proof_url ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 px-2 text-xs"
                      onClick={() => fileViewer.open(payment.proof_url, 'Comprobante de abono')}
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver comprobante
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {invoice ? (
        <AdminAbonoModal
          open={abonoOpen}
          onClose={() => setAbonoOpen(false)}
          invoice={invoice}
          paidAmount={approved}
          balance={balance}
          onSaved={onSaved}
        />
      ) : null}

      {fileViewer.modal}
    </div>
  );
}