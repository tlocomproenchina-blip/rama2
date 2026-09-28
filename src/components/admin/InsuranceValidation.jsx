import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import useEntitySubscription from '@/hooks/useEntitySubscription';

const methodLabels = {
  binance: 'Binance',
  usdt_trc20: 'USDT TRC20',
  paypal: 'PayPal',
  wally: 'Wally',
  zinli: 'Zinli',
  wise: 'Wise',
  skrill: 'Skrill',
  pago_movil_usdt: 'Pago Móvil → USDT',
  transferencia: 'Transferencia',
  stripe: 'Tarjeta',
  otro: 'Otro'
};

export default function InsuranceValidation({ onRefresh, currentUser }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  const loadPayments = async () => {
    try {
      const pending = await base44.entities.InsurancePayment.filter({ status: 'pendiente' }, '-created_date', 200);
      setPayments(pending || []);
    } catch (e) {
      console.error('Error loading insurance payments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  useEntitySubscription('InsurancePayment', (event) => {
    if (event.type === 'create') loadPayments();
  });

  const handleApprove = async (payment) => {
    setProcessing(payment.id);
    try {
      const res = await base44.functions.invoke('approveInsurancePayment', { payment_id: payment.id });
      if (res?.data?.success) {
        toast.success(`Seguro aprobado · ${payment.tracking_number} asegurado`);
        setPayments((prev) => prev.filter((p) => p.id !== payment.id));
        onRefresh?.();
      } else {
        toast.error(res?.data?.error || 'Error al aprobar el seguro');
      }
    } catch (e) {
      toast.error('Error al aprobar el seguro');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (payment) => {
    const reason = window.prompt ? null : null;
    setProcessing(payment.id);
    try {
      const res = await base44.functions.invoke('rejectInsurancePayment', { payment_id: payment.id, reason: '' });
      if (res?.data?.success) {
        toast.success(`Seguro rechazado · ${payment.tracking_number}`);
        setPayments((prev) => prev.filter((p) => p.id !== payment.id));
        onRefresh?.();
      } else {
        toast.error(res?.data?.error || 'Error al rechazar el seguro');
      }
    } catch (e) {
      toast.error('Error al rechazar el seguro');
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

  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No hay pagos de seguro pendientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
        <Shield className="h-4 w-4 text-emerald-600" />
        Pagos de Seguro Pendientes ({payments.length})
      </h2>
      {payments.map((p) => (
        <Card key={p.id} className="border-emerald-200 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    <Shield className="h-3 w-3 mr-1" /> SEGURO
                  </Badge>
                  <span className="font-mono font-semibold text-slate-800 text-sm">{p.tracking_number}</span>
                </div>
                <p className="text-xs text-slate-500">{p.client_email}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-600">
                  <span>FOB: ${Number(p.fob_value || 0).toFixed(2)}</span>
                  <span>·</span>
                  <span>Método: {methodLabels[p.method] || p.method}</span>
                  {p.reference && (<><span>·</span><span>Ref: {p.reference}</span></>)}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-slate-500">Seguro</p>
                  <p className="text-lg font-bold text-emerald-700">${Number(p.amount || 0).toFixed(2)}</p>
                </div>
                {p.proof_url && (
                  <a
                    href={p.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50"
                    title="Ver comprobante"
                  >
                    <ExternalLink className="h-4 w-4 text-slate-600" />
                  </a>
                )}
                <Button
                  size="sm"
                  onClick={() => handleApprove(p)}
                  disabled={processing === p.id}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {processing === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReject(p)}
                  disabled={processing === p.id}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}