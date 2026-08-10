import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { base44 } from '@/api/base44Client';
import { CreditCard, CheckCircle, XCircle, Eye, DollarSign, Calendar, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import useFileViewer from '@/hooks/useFileViewer';

export default function PaymentValidation({ consolidations, clients, onRefresh, currentUser }) {
  const fileViewer = useFileViewer();
  const [rejectModal, setRejectModal] = useState({ open: false, consolidation: null });
  const [rejectComment, setRejectComment] = useState('');
  const [processing, setProcessing] = useState(null);
  const [hiddenIds, setHiddenIds] = useState([]);

  const pendingPayments = (consolidations?.filter(c => c.status === 'pago_pendiente_validacion') || [])
    .filter(c => !hiddenIds.includes(c.id));

  const getClientInfo = (email) => {
    return clients?.find(c => c.email === email) || {};
  };

  const handleValidate = async (consolidation) => {
    setProcessing(consolidation.id);
    try {
      await base44.entities.Consolidation.update(consolidation.id, {
        payment_validated: true,
        payment_validated_by: currentUser.email,
        payment_validation_date: new Date().toISOString(),
        status: 'en_transito'
      });

      // Update package statuses
      for (const pkgId of (consolidation.package_ids || [])) {
        await base44.entities.Package.update(pkgId, { status: 'en_transito' });
      }

      // Update related invoice to 'pagada'
      const relatedInvoices = await base44.entities.Invoice.filter({ consolidation_id: consolidation.id });
      if (relatedInvoices && relatedInvoices.length > 0) {
        await base44.entities.Invoice.update(relatedInvoices[0].id, {
          status: 'pagada',
          payment_date: new Date().toISOString(),
          payment_method: consolidation.payment_method || relatedInvoices[0].payment_method || 'transferencia'
        });
        // Marcar la factura de Stripe como pagada en segundo plano (no bloquea la validación)
        base44.functions.invoke('markStripeInvoicePaid', { invoiceId: relatedInvoices[0].id })
          .catch((e) => console.error('No se pudo marcar la factura de Stripe como pagada:', e));
      }

      // Notify client (async, don't wait)
      base44.integrations.Core.SendEmail({
        to: consolidation.client_email,
        subject: '✅ Pago validado - Tu carga está en camino',
        body: `¡Excelente! Tu pago ha sido validado.\n\nTracking: ${consolidation.consolidation_tracking}\nMonto: $${consolidation.payment_amount}\n\nTu carga está ahora en tránsito.`
      }).catch(err => console.error('Email error:', err));

      base44.entities.Notification.create({
        user_email: consolidation.client_email,
        title: '✅ Pago Validado',
        message: `Tu pago de $${consolidation.payment_amount} para ${consolidation.consolidation_tracking} ha sido validado.`,
        type: 'payment',
        icon: 'check',
        reference_id: consolidation.id
      }).catch(err => console.error('Notification error:', err));

      setHiddenIds((prev) => [...prev, consolidation.id]);
      toast.success('Pago validado correctamente');
    } catch (error) {
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

    setProcessing(rejectModal.consolidation.id);
    try {
      await base44.entities.Consolidation.update(rejectModal.consolidation.id, {
        payment_validated: false,
        payment_rejection_comment: rejectComment,
        status: 'pendiente_pago'
      });

      // Reabrir factura para que el cliente pueda volver a pagar
      const invs = await base44.entities.Invoice.filter({ consolidation_id: rejectModal.consolidation.id });
      if (invs && invs.length > 0) {
        await base44.entities.Invoice.update(invs[0].id, {
          status: 'pendiente',
          notes: `Pago rechazado: ${rejectComment}`
        });
      }

      // Notify client (async, don't wait)
      base44.integrations.Core.SendEmail({
        to: rejectModal.consolidation.client_email,
        subject: '❌ Pago rechazado',
        body: `Tu pago no pudo ser validado.\n\nTracking: ${rejectModal.consolidation.consolidation_tracking}\nMotivo: ${rejectComment}\n\nPor favor intenta nuevamente.`
      }).catch(err => console.error('Email error:', err));

      base44.entities.Notification.create({
        user_email: rejectModal.consolidation.client_email,
        title: '❌ Pago Rechazado',
        message: `Tu pago para ${rejectModal.consolidation.consolidation_tracking} fue rechazado. Motivo: ${rejectComment}`,
        type: 'payment',
        icon: 'alert',
        reference_id: rejectModal.consolidation.id
      }).catch(err => console.error('Notification error:', err));

      setHiddenIds((prev) => [...prev, rejectModal.consolidation.id]);
      toast.success('Pago rechazado');
      setRejectModal({ open: false, consolidation: null });
      setRejectComment('');
    } catch (error) {
      toast.error('Error al rechazar el pago');
    } finally {
      setProcessing(null);
    }
  };

  if (pendingPayments.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No hay pagos pendientes de validación</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {pendingPayments.map((cons) => {
          const client = getClientInfo(cons.client_email);

          return (
            <Card key={cons.id} className="border-l-4 border-l-yellow-500 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <User className="w-4 h-4" />
                      Cliente
                    </div>
                    <div className="font-medium text-slate-800">
                      {`${client.first_name || ''} ${client.last_name || ''}`.trim() || client.full_name || cons.client_email}
                    </div>
                    <div className="text-xs text-slate-500">{client.shipping_mark || cons.shipping_mark || cons.client_email}</div>
                  </div>

                  <div>
                    <div className="text-slate-500 text-sm mb-1">Consolidación</div>
                    <div className="font-medium font-mono text-slate-800">{cons.consolidation_tracking}</div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <DollarSign className="w-4 h-4" />
                      Total / Reportado
                    </div>
                    <div className="font-medium text-slate-800">
                      ${cons.total_cost?.toFixed(2)} / <span className="text-emerald-600">${cons.payment_amount?.toFixed(2)}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                      <Calendar className="w-4 h-4" />
                      Fecha de Pago
                    </div>
                    <div className="font-medium text-slate-800">
                      {cons.payment_date ? format(new Date(cons.payment_date), 'dd/MM/yyyy HH:mm') : '-'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="capitalize">
                    {cons.payment_method === 'usdt_trc20' ? 'USDT TRC20' : 'Binance'}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileViewer.open(cons.payment_proof_url, 'Comprobante de Pago')}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Ver Comprobante
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleValidate(cons)}
                    disabled={processing === cons.id}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {processing === cons.id ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Procesando...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-1" /> Validar</>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setRejectModal({ open: true, consolidation: cons })}
                    disabled={processing === cons.id}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {fileViewer.modal}

      <Dialog open={rejectModal.open} onOpenChange={() => setRejectModal({ open: false, consolidation: null })}>
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
            <Button variant="outline" onClick={() => setRejectModal({ open: false, consolidation: null })}>
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