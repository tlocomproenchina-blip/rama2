import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { base44 } from '@/api/base44Client';
import { FileText, CheckCircle, XCircle, Eye, DollarSign, Calendar, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import useFileViewer from '@/hooks/useFileViewer';

const METHOD_LABELS = {
  usdt_trc20: 'USDT TRC20',
  binance: 'Binance',
  paypal: 'PayPal',
  wally: 'Wally',
  zinli: 'Zinli',
  wise: 'Wise',
  skrill: 'Skrill',
  pago_movil_usdt: 'Pago Móvil → USDT'
};

// Valida pagos reportados sobre FACTURAS (incluyendo facturas manuales sin consolidación).
// Estas facturas quedan en estado 'revision' con el comprobante en payment_reference.
export default function InvoicePaymentValidation({ invoices, clients, onRefresh, currentUser }) {
  const fileViewer = useFileViewer();
  const [rejectModal, setRejectModal] = useState({ open: false, invoice: null });
  const [rejectComment, setRejectComment] = useState('');
  const [processing, setProcessing] = useState(null);
  const [validatedIds, setValidatedIds] = useState([]);

  const getClientInfo = (email) => clients?.find(c => c.email === email) || {};
  const isProofUrl = (val) => typeof val === 'string' && val.startsWith('http');

  const handleValidate = async (invoice) => {
    setProcessing(invoice.id);
    try {
      // Misma lógica de servidor que la aprobación en bloque (bulkApprovePayments)
      const res = await base44.functions.invoke('bulkApprovePayments', { type: 'facturas', ids: [invoice.id] });
      const data = res?.data || {};
      if (data.success && data.approved_count > 0) {
        setValidatedIds((prev) => [...prev, invoice.id]);
        toast.success('Pago validado correctamente');
      } else {
        toast.error(data.failed?.[0]?.error || data.error || 'Error al validar el pago');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al validar el pago');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectComment.trim()) {
      toast.error('Por favor ingresa un comentario');
      return;
    }
    setProcessing(rejectModal.invoice.id);
    try {
      await base44.entities.Invoice.update(rejectModal.invoice.id, {
        status: 'pendiente',
        notes: `Pago rechazado: ${rejectComment}`
      });

      base44.entities.Notification.create({
        user_email: rejectModal.invoice.client_email,
        title: '❌ Pago Rechazado',
        message: `Tu pago para la factura ${rejectModal.invoice.invoice_number} fue rechazado. Motivo: ${rejectComment}`,
        type: 'payment',
        icon: 'alert',
        reference_id: rejectModal.invoice.id
      }).catch(err => console.error('Notification error:', err));

      base44.integrations.Core.SendEmail({
        to: rejectModal.invoice.client_email,
        subject: '❌ Pago rechazado',
        body: `Tu pago de la factura ${rejectModal.invoice.invoice_number} no pudo ser validado.\n\nMotivo: ${rejectComment}\n\nPor favor intenta nuevamente.`
      }).catch(err => console.error('Email error:', err));

      setValidatedIds((prev) => [...prev, rejectModal.invoice.id]);
      toast.success('Pago rechazado');
      setRejectModal({ open: false, invoice: null });
      setRejectComment('');
    } catch (error) {
      console.error(error);
      toast.error('Error al rechazar el pago');
    } finally {
      setProcessing(null);
    }
  };

  const visibleInvoices = (invoices || []).filter((i) => !validatedIds.includes(i.id));
  if (visibleInvoices.length === 0) return null;

  return (
    <>
      <div className="space-y-4">
        {visibleInvoices.map((inv) => {
          const client = getClientInfo(inv.client_email);
          const proofUrl = isProofUrl(inv.payment_reference) ? inv.payment_reference : null;

          return (
            <Card key={inv.id} className="border-l-4 border-l-violet-500 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <User className="w-4 h-4" /> Cliente
                    </div>
                    <div className="font-medium text-slate-800">
                      {`${client.first_name || ''} ${client.last_name || ''}`.trim() || client.full_name || inv.client_email}
                    </div>
                    <div className="text-xs text-slate-500">{client.shipping_mark || inv.client_email}</div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <FileText className="w-4 h-4" /> Factura
                    </div>
                    <div className="font-medium font-mono text-slate-800">{inv.invoice_number}</div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <DollarSign className="w-4 h-4" /> Total
                    </div>
                    <div className="font-medium text-emerald-600">${Number(inv.total || 0).toFixed(2)}</div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <Calendar className="w-4 h-4" /> Fecha de Pago
                    </div>
                    <div className="font-medium text-slate-800">
                      {inv.payment_date ? format(new Date(inv.payment_date), 'dd/MM/yyyy HH:mm') : '-'}
                    </div>
                  </div>
                </div>

                {inv.payment_method && (
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline" className="capitalize">
                      {METHOD_LABELS[inv.payment_method] || inv.payment_method}
                    </Badge>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {proofUrl ? (
                    <Button variant="outline" size="sm" onClick={() => fileViewer.open(proofUrl, 'Comprobante de Pago')}>
                      <Eye className="w-4 h-4 mr-1" /> Ver Comprobante
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400">Sin comprobante adjunto</span>
                  )}

                  <Button
                    size="sm"
                    onClick={() => handleValidate(inv)}
                    disabled={processing === inv.id}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {processing === inv.id ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Procesando...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-1" /> Validar</>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setRejectModal({ open: true, invoice: inv })}
                    disabled={processing === inv.id}
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {fileViewer.modal}

      <Dialog open={rejectModal.open} onOpenChange={() => setRejectModal({ open: false, invoice: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">
              Por favor indica el motivo del rechazo. Este mensaje será visible para el cliente.
            </p>
            <Textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="Motivo del rechazo..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal({ open: false, invoice: null })}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}