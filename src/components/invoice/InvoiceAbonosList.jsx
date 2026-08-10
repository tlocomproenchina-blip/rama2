import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import useFileViewer from '@/hooks/useFileViewer';

const METHOD_LABELS = {
  transferencia: 'Transferencia',
  usdt_trc20: 'USDT TRC20',
  binance: 'Binance',
  paypal: 'PayPal',
  wally: 'Wally',
  zinli: 'Zinli',
  wise: 'Wise',
  skrill: 'Skrill',
  pago_movil_usdt: 'Pago Móvil → USDT',
  stripe: 'Stripe',
  otro: 'Otro'
};

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  aprobado: { label: 'Aprobado', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  rechazado: { label: 'Rechazado', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
};

export default function InvoiceAbonosList({ invoice, isAdmin = false, onRefresh }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const fileViewer = useFileViewer();
  const [rejectModal, setRejectModal] = useState({ open: false, payment: null });
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(null);

  const loadPayments = async () => {
    if (!invoice?.id) return;
    setLoading(true);
    try {
      const data = await base44.entities.InvoicePayment.filter({ invoice_id: invoice.id }, '-created_date', 100);
      setPayments(data || []);
    } catch (e) {
      console.error('Error loading abonos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoice?.id) loadPayments();
  }, [invoice?.id]);

  const handleApprove = async (payment) => {
    setProcessing(payment.id);
    try {
      const res = await base44.functions.invoke('approveInvoicePayment', { payment_id: payment.id });
      if (res.status === 200 && res.data?.success) {
        toast.success(res.data?.fully_paid ? 'Abono aprobado. Factura pagada completamente.' : 'Abono aprobado');
        await loadPayments();
        onRefresh?.();
      } else {
        toast.error(res.data?.error || 'Error al aprobar abono');
      }
    } catch (e) {
      toast.error('Error al aprobar abono');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.payment) return;
    setProcessing(rejectModal.payment.id);
    try {
      const res = await base44.functions.invoke('rejectInvoicePayment', {
        payment_id: rejectModal.payment.id,
        reason: rejectReason
      });
      if (res.status === 200 && res.data?.success) {
        toast.success('Abono rechazado');
        setRejectModal({ open: false, payment: null });
        setRejectReason('');
        await loadPayments();
        onRefresh?.();
      } else {
        toast.error(res.data?.error || 'Error al rechazar abono');
      }
    } catch (e) {
      toast.error('Error al rechazar abono');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (payments.length === 0) {
    return <p className="text-xs text-slate-400 py-2">Sin abonos registrados.</p>;
  }

  return (
    <>
      <div className="space-y-2">
        {payments.map((p) => {
          const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pendiente;
          const StatusIcon = cfg.icon;
          return (
            <div key={p.id} className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">${Number(p.amount || 0).toFixed(2)}</span>
                    <span className="text-xs text-slate-500">·</span>
                    <span className="text-xs text-slate-600">{METHOD_LABELS[p.method] || p.method}</span>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
                      <StatusIcon className="h-3 w-3" /> {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {format(new Date(p.created_date), 'dd/MM/yyyy HH:mm')}
                    {p.reference && ` · Ref: ${p.reference}`}
                  </p>
                  {p.status === 'rechazado' && p.reject_reason && (
                    <p className="text-xs text-red-600 mt-1">Motivo: {p.reject_reason}</p>
                  )}
                  {p.status === 'aprobado' && p.approved_date && (
                    <p className="text-xs text-emerald-600 mt-1">
                      Aprobado: {format(new Date(p.approved_date), 'dd/MM/yyyy HH:mm')}
                      {p.approved_by && ` por ${p.approved_by}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.proof_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => fileViewer.open(p.proof_url, 'Comprobante de Abono')}
                    >
                      Ver comprobante
                    </Button>
                  )}
                </div>
              </div>

              {isAdmin && p.status === 'pendiente' && (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={processing === p.id}
                    onClick={() => handleApprove(p)}
                  >
                    {processing === p.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                    Aprobar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8"
                    disabled={processing === p.id}
                    onClick={() => { setRejectModal({ open: true, payment: p }); setRejectReason(''); }}
                  >
                    <XCircle className="h-3 w-3 mr-1" /> Rechazar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal comprobante */}
      {fileViewer.modal}

      {/* Modal rechazo */}
      <Dialog open={rejectModal.open} onOpenChange={() => setRejectModal({ open: false, payment: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Abono</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">
              Indica el motivo del rechazo. El cliente será notificado.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo del rechazo..."
              rows={3}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setRejectModal({ open: false, payment: null })}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" disabled={processing === rejectModal.payment?.id} onClick={handleReject}>
              {processing === rejectModal.payment?.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar Rechazo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}