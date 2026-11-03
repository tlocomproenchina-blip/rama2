import React, { useEffect, useMemo, useState } from 'react';
import { format, differenceInDays, parse } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Copy,
  Edit2,
  MapPin,
  Package,
  Plane,
  Ship,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusClasses = {
  en_transito: 'bg-blue-100 text-blue-700',
  pago_validado: 'bg-amber-100 text-amber-700',
  disponible: 'bg-emerald-100 text-emerald-700',
  entregado: 'bg-green-100 text-green-700',
};

const statusLabels = {
  en_transito: 'En Tránsito',
  pago_validado: 'Pago Validado',
  disponible: 'Disponible',
  entregado: 'Entregado',
};

const paymentMethods = [
  { value: 'binance', label: 'Binance' },
  { value: 'usdt_trc20', label: 'USDT (TRC20)' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'debito_internacional', label: 'Débito Internacional' },
  { value: 'wally', label: 'Wally' },
  { value: 'zinli', label: 'Zinli' },
  { value: 'wise', label: 'Wise' },
  { value: 'skrill', label: 'Skrill' },
  { value: 'pago_movil_usdt', label: 'Pago Móvil USDT' },
];

const stageOrder = ['en_transito', 'pago_validado', 'disponible', 'entregado'];

const formatDateTime = (value, template = 'dd/MM/yyyy') => {
  if (!value) return '-';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return format(date, template);
  } catch {
    return '-';
  }
};

const formatEstimatedDate = (value) => {
  if (!value) return '-';
  try {
    const date = typeof value === 'string' ? parse(value, 'yyyy-MM-dd', new Date()) : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return format(date, 'dd/MM/yyyy');
  } catch {
    return '-';
  }
};

export default function TrackingShipmentCard({ consolidation, user, isPending = false, hasFailedRequest = false, queryKey, onStatusChange, onEditDate, onDataChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(consolidation.payment_amount || '');
  const [paymentMethod, setPaymentMethod] = useState(consolidation.payment_method || '');
  const [paymentProof, setPaymentProof] = useState(consolidation.payment_proof_url || '');
  const queryClient = useQueryClient();
  const [savingPayment, setSavingPayment] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [paymentActionFailed, setPaymentActionFailed] = useState(false);

  useEffect(() => {
    setPaymentAmount(consolidation.payment_amount || '');
    setPaymentMethod(consolidation.payment_method || '');
    setPaymentProof(consolidation.payment_proof_url || '');
  }, [consolidation.id, consolidation.payment_amount, consolidation.payment_method, consolidation.payment_proof_url]);

  const expectedTransitDays = consolidation.shipping_type === 'maritimo' ? 90 : 30;

  const progress = useMemo(() => {
    if (consolidation.status === 'entregado') return 100;
    if (consolidation.status === 'disponible') return 86;
    if (consolidation.status === 'pago_validado') return 68;
    if (!consolidation.created_date || !consolidation.estimated_delivery) return 40;

    try {
      const start = new Date(consolidation.created_date);
      const end = parse(consolidation.estimated_delivery, 'yyyy-MM-dd', new Date());
      const today = new Date();
      const total = differenceInDays(end, start);
      const elapsed = differenceInDays(today, start);
      if (total <= 0) return 100;
      return Math.max(8, Math.min(100, Math.round((elapsed / total) * 100)));
    } catch {
      return 40;
    }
  }, [consolidation]);

  const remainingDays = useMemo(() => {
    if (!consolidation.estimated_delivery) return null;
    try {
      const estimated = parse(consolidation.estimated_delivery, 'yyyy-MM-dd', new Date());
      return differenceInDays(estimated, new Date());
    } catch {
      return null;
    }
  }, [consolidation.estimated_delivery]);

  const completedStages = stageOrder.filter((stage) => {
    if (stage === 'en_transito') return ['en_transito', 'pago_validado', 'disponible', 'entregado'].includes(consolidation.status);
    if (stage === 'pago_validado') return consolidation.payment_validated || ['pago_validado', 'disponible', 'entregado'].includes(consolidation.status);
    if (stage === 'disponible') return ['disponible', 'entregado'].includes(consolidation.status);
    return consolidation.status === 'entregado';
  });

  const paymentBadge = consolidation.payment_validated
    ? { label: 'Pago validado', className: 'bg-emerald-100 text-emerald-700' }
    : consolidation.payment_proof_url
      ? { label: 'Pago por validar', className: 'bg-amber-100 text-amber-700' }
      : { label: 'Pendiente pago', className: 'bg-primary text-primary-foreground' };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(consolidation.consolidation_tracking || '');
    toast.success('Tracking copiado');
  };

  const updateTrackingCache = async (updater) => {
    if (!queryKey) return { previousConsolidations: null };
    await queryClient.cancelQueries({ queryKey });
    const previousConsolidations = queryClient.getQueryData(queryKey) || [];
    queryClient.setQueryData(queryKey, previousConsolidations.map((item) => item.id === consolidation.id ? updater(item) : item));
    return { previousConsolidations };
  };

  const uploadProofMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Consolidation.update(consolidation.id, {
        payment_proof_url: file_url,
        payment_date: new Date().toISOString(),
      });
      return file_url;
    },
    onMutate: async () => {
      setPaymentActionFailed(false);
      setUploadingProof(true);
      return await updateTrackingCache((item) => ({ ...item, payment_date: new Date().toISOString() }));
    },
    onSuccess: (fileUrl) => {
      setPaymentProof(fileUrl);
      toast.success('Comprobante subido');
    },
    onError: (_error, _variables, context) => {
      if (queryKey) {
        queryClient.setQueryData(queryKey, context?.previousConsolidations || []);
      }
      setPaymentActionFailed(true);
      toast.error('Error al subir comprobante');
    },
    onSettled: () => {
      setUploadingProof(false);
      if (queryKey) queryClient.invalidateQueries({ queryKey });
      onDataChanged?.();
    }
  });

  const savePaymentMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Consolidation.update(consolidation.id, {
        payment_amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
      });
    },
    onMutate: async () => {
      setPaymentActionFailed(false);
      setSavingPayment(true);
      return await updateTrackingCache((item) => ({
        ...item,
        payment_amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
      }));
    },
    onSuccess: () => {
      toast.success('Pago guardado');
    },
    onError: (_error, _variables, context) => {
      if (queryKey) {
        queryClient.setQueryData(queryKey, context?.previousConsolidations || []);
      }
      setPaymentActionFailed(true);
      toast.error('Error al guardar pago');
    },
    onSettled: () => {
      setSavingPayment(false);
      if (queryKey) queryClient.invalidateQueries({ queryKey });
      onDataChanged?.();
    }
  });

  const validatePaymentMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Consolidation.update(consolidation.id, {
        payment_validated: true,
        payment_validation_date: new Date().toISOString(),
        payment_validated_by: user?.email || '',
        status: 'pago_validado',
      });
    },
    onMutate: async () => {
      setPaymentActionFailed(false);
      return await updateTrackingCache((item) => ({
        ...item,
        payment_validated: true,
        payment_validation_date: new Date().toISOString(),
        payment_validated_by: user?.email || '',
        status: 'pago_validado',
      }));
    },
    onSuccess: () => {
      toast.success('Pago validado');
    },
    onError: (_error, _variables, context) => {
      if (queryKey) {
        queryClient.setQueryData(queryKey, context?.previousConsolidations || []);
      }
      setPaymentActionFailed(true);
      toast.error('Error al validar pago');
    },
    onSettled: () => {
      if (queryKey) queryClient.invalidateQueries({ queryKey });
      onDataChanged?.();
    }
  });

  const handleUploadProof = async (file) => {
    uploadProofMutation.mutate(file);
  };

  const handleSavePayment = async () => {
    if (!paymentAmount || !paymentMethod) {
      toast.error('Ingresa monto y método');
      return;
    }

    savePaymentMutation.mutate();
  };

  const handleValidatePayment = async () => {
    validatePaymentMutation.mutate();
  };

  return (
    <Card className={`overflow-hidden rounded-2xl border-0 shadow-md transition-all hover:shadow-lg ${(isPending || savingPayment || uploadingProof) ? 'opacity-75' : ''} ${(hasFailedRequest || paymentActionFailed) ? 'ring-1 ring-rose-200 bg-rose-50/30' : ''}`}>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full bg-white px-5 py-5 text-left"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-mono text-sm font-bold text-slate-900 lg:text-base">
                {consolidation.consolidation_tracking}
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleCopy(); }}>
                <Copy className="h-4 w-4 text-slate-500" />
              </Button>
              <Badge className={statusClasses[consolidation.status] || 'bg-slate-100 text-slate-700'}>
                {statusLabels[consolidation.status] || consolidation.status}
              </Badge>
              <Badge className={paymentBadge.className}>{paymentBadge.label}</Badge>
              {isPending && <Badge className="bg-slate-100 text-slate-700">Actualizando...</Badge>}
              {hasFailedRequest && <Badge className="bg-rose-100 text-rose-700">Revisar cambio</Badge>}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              {user?.role === 'admin' && <span className="truncate">{consolidation.client_email}</span>}
              <Badge variant="outline" className="gap-1 rounded-full border-slate-200 bg-white">
                {consolidation.shipping_type === 'aereo' ? <Plane className="h-3 w-3" /> : <Ship className="h-3 w-3" />}
                {consolidation.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}
              </Badge>
              {consolidation.shipping_mark && (
                <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
                  {consolidation.shipping_mark}
                </Badge>
              )}
            </div>

            <div className="mt-4 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Progreso</span>
                <span className="text-blue-600">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 lg:justify-end">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2">
              <div
                className="grid h-11 w-11 place-items-center rounded-full"
                style={{ backgroundImage: `conic-gradient(#2563eb ${progress}%, #e2e8f0 0)` }}
              >
                <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-[10px] font-semibold text-slate-700">
                  {progress}%
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">Tránsito / Estimado</p>
                <p className="text-lg font-bold text-slate-900">
                  {expectedTransitDays}d / {remainingDays === null ? '-' : `${remainingDays}d`}
                </p>
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {expanded && (
        <CardContent className="space-y-5 border-t border-slate-100 bg-slate-50/60 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Fecha de salida</p>
              <p className="mt-1 font-semibold text-slate-900">{formatDateTime(consolidation.shipping_date)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Entrega estimada</p>
              <p className="mt-1 font-semibold text-slate-900">{formatEstimatedDate(consolidation.estimated_delivery)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Paquetes incluidos</p>
              <p className="mt-1 font-semibold text-slate-900">{consolidation.package_ids?.length || 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Costo total</p>
              <p className="mt-1 font-semibold text-slate-900">
                {typeof consolidation.total_cost === 'number' ? `$${consolidation.total_cost.toFixed(2)}` : '-'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'en_transito', label: 'En tránsito' },
                { key: 'pago_validado', label: 'Pago validado' },
                { key: 'disponible', label: 'Disponible' },
                { key: 'entregado', label: 'Entregado' },
              ].map((stage) => {
                const active = completedStages.includes(stage.key);
                return (
                  <div
                    key={stage.key}
                    className={`rounded-full px-3 py-2 text-xs font-medium ${active ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {stage.label}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
                <MapPin className="h-4 w-4" />
                Pago y comprobante
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  disabled={consolidation.payment_validated}
                  placeholder="Monto"
                  className="bg-white"
                />
                <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={consolidation.payment_validated}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Método" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  id={`proof-${consolidation.id}`}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUploadProof(e.target.files[0])}
                  disabled={consolidation.payment_validated}
                />
                <label htmlFor={`proof-${consolidation.id}`}>
                  <Button type="button" variant="outline" className="bg-white" disabled={uploadingProof || consolidation.payment_validated}>
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingProof ? 'Subiendo...' : 'Subir comprobante'}
                  </Button>
                </label>
                {paymentProof && (
                  <a href={paymentProof} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 underline">
                    Ver comprobante
                  </a>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={handleSavePayment} disabled={savingPayment || consolidation.payment_validated} className="bg-blue-600 hover:bg-blue-700">
                  {savingPayment ? 'Guardando...' : 'Guardar pago'}
                </Button>
                {user?.role === 'admin' && !consolidation.payment_validated && (
                  <Button variant="secondary" onClick={handleValidatePayment}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Validar pago
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Package className="h-4 w-4" />
                Gestión del envío
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Peso facturable</p>
                  <p className="mt-1 font-semibold text-slate-900">{consolidation.billable_weight || '-'} kg</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Estado actual</p>
                  <p className="mt-1 font-semibold text-slate-900">{statusLabels[consolidation.status] || consolidation.status}</p>
                </div>
              </div>

              {user?.role === 'admin' && (
                <div className="mt-4 space-y-3">
                  <Button variant="outline" onClick={() => onEditDate(consolidation)} className="w-full justify-start">
                    <Edit2 className="mr-2 h-4 w-4" />
                    Editar fechas
                  </Button>

                  {['en_transito', 'pago_validado'].includes(consolidation.status) && (
                    <Select onValueChange={(value) => onStatusChange(consolidation, value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Cambiar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disponible">Disponible</SelectItem>
                        <SelectItem value="entregado">Entregado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {remainingDays !== null && (
                <div className={`mt-4 rounded-xl p-3 text-sm ${remainingDays < 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {remainingDays < 0 ? `${Math.abs(remainingDays)} día(s) de retraso` : `${remainingDays} día(s) restantes estimados`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}