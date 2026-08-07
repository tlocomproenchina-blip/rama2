import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FileText, CheckCircle, XCircle, Eye, DollarSign, Calendar, User, Loader2, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

export default function AdminAbonosValidation({ onRefresh }) {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState({});
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);
  const [proofModal, setProofModal] = useState({ open: false, url: '' });
  const [rejectModal, setRejectModal] = useState({ open: false, payment: null });
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(null);
  // IDs ya aprobados/rechazados localmente: se filtran para evitar que reaparezcan
  // por consistencia eventual del servidor tras el cambio de estado.
  const processedIds = useRef(new Set());

  const loadPendingAbonos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.InvoicePayment.filter({ status: 'pendiente' }, '-created_date', 200);
      const filtered = (data || []).filter((p) => !processedIds.current.has(p.id));
      setPayments(filtered);

      // Cargar facturas relacionadas para mostrar total y saldo
      const invIds = Array.from(new Set(filtered.map((p) => p.invoice_id).filter(Boolean)));
      if (invIds.length) {
        const invs = await base44.entities.Invoice.filter({ id: { $in: invIds } }, '-invoice_date', invIds.length);
        const map = {};
        (invs || []).forEach((inv) => { map[inv.id] = inv; });
        setInvoices(map);
      } else {
        setInvoices({});
      }

      // Cargar datos de cliente (nombre + shipping mark) para evitar mostrar el email largo
      const emails = Array.from(new Set(filtered.map((p) => p.client_email).filter(Boolean)));
      if (emails.length) {
        const res = await base44.functions.invoke('getClientsByEmails', { emails }).catch(() => null);
        const cmap = {};
        Object.values(res?.data?.clients || {}).forEach((c) => { cmap[c.email] = c; });
        setClients(cmap);
      } else {
        setClients({});
      }
    } catch (e) {
      console.error('Error loading abonos:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingAbonos();
  }, [loadPendingAbonos]);

  const handleApprove = async (payment) => {
    setProcessing(payment.id);
    try {
      const res = await base44.functions.invoke('approveInvoicePayment', { payment_id: payment.id });
      if (res.status === 200 && res.data?.success) {
        toast.success(res.data?.fully_paid ? 'Abono aprobado. Factura pagada completamente.' : 'Abono aprobado');
        // Marcar como procesado y remover optimistamente (evita reaparición por consistencia eventual)
        processedIds.current.add(payment.id);
        setPayments((prev) => prev.filter((p) => p.id !== payment.id));
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
    const paymentId = rejectModal.payment.id;
    setProcessing(paymentId);
    try {
      const res = await base44.functions.invoke('rejectInvoicePayment', {
        payment_id: paymentId,
        reason: rejectReason
      });
      if (res.status === 200 && res.data?.success) {
        toast.success('Abono rechazado');
        setRejectModal({ open: false, payment: null });
        setRejectReason('');
        // Marcar como procesado y remover optimistamente (evita reaparición por consistencia eventual)
        processedIds.current.add(paymentId);
        setPayments((prev) => prev.filter((p) => p.id !== paymentId));
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (payments.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Abonos pendientes de validación
          <Badge variant="secondary" className="ml-1">{payments.length}</Badge>
        </h2>
        {payments.map((p) => {
          const inv = invoices[p.invoice_id] || {};
          const client = clients[p.client_email] || {};
          const total = Number(inv.total || 0);
          const paidAmount = Number(inv.paid_amount || 0);
          const balance = Math.max(0, total - paidAmount);
          const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.full_name || p.client_email;

          return (
            <Card key={p.id} className="border-l-4 border-l-emerald-500 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <User className="w-4 h-4" /> Cliente
                    </div>
                    <div className="font-medium text-slate-800 text-sm leading-tight truncate">{clientName}</div>
                    {client.shipping_mark && (
                      <div className="text-xs text-slate-500 truncate">Mark: {client.shipping_mark}</div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <FileText className="w-4 h-4" /> Factura
                    </div>
                    <div className="font-medium font-mono text-slate-800 text-sm">{p.invoice_number || inv.invoice_number || 'N/A'}</div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <DollarSign className="w-4 h-4" /> Abono
                    </div>
                    <div className="font-bold text-emerald-600">${Number(p.amount || 0).toFixed(2)}</div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <DollarSign className="w-4 h-4" /> Saldo factura
                    </div>
                    <div className="font-medium text-amber-600 text-sm">
                      ${balance.toFixed(2)} / ${total.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <Calendar className="w-4 h-4" /> Fecha
                    </div>
                    <div className="font-medium text-slate-800 text-sm">
                      {format(new Date(p.created_date), 'dd/MM/yyyy HH:mm')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge variant="outline" className="capitalize">
                    {METHOD_LABELS[p.method] || p.method}
                  </Badge>
                  {p.reference && (
                    <span className="text-xs text-slate-500">Ref: {p.reference}</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {p.proof_url && (
                    <Button variant="outline" size="sm" onClick={() => setProofModal({ open: true, url: p.proof_url })}>
                      <Eye className="w-4 h-4 mr-1" /> Ver Comprobante
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleApprove(p)}
                    disabled={processing === p.id}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {processing === p.id ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Procesando...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-1" /> Aprobar</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => { setRejectModal({ open: true, payment: p }); setRejectReason(''); }}
                    disabled={processing === p.id}
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={proofModal.open} onOpenChange={() => setProofModal({ open: false, url: '' })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprobante de Abono</DialogTitle>
          </DialogHeader>
          <img src={proofModal.url} alt="Comprobante" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>

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