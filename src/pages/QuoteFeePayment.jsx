import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, Package, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import StripeCheckout from '@/components/payments/StripeCheckout';
import PagoMovilBsDisplay from '@/components/payments/PagoMovilBsDisplay';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeStates } from '@/components/utils/states';

const METHOD_LABELS = {
  stripe: { label: 'Tarjeta (Stripe)', icon: '💳' },
  paypal: { label: 'PayPal', icon: '🅿️' },
  binance: { label: 'Binance Pay', icon: '🅱️' },
  usdt_trc20: { label: 'USDT TRC20', icon: '₮' },
  transferencia: { label: 'Transferencia', icon: '🏦' },
  wally: { label: 'Wally', icon: '💳' },
  zinli: { label: 'Zinli', icon: '💳' },
  wise: { label: 'Wise', icon: '💳' },
  skrill: { label: 'Skrill', icon: '💳' },
  pago_movil_usdt: { label: 'Pago Móvil USDT', icon: '📱' },
  zelle: { label: 'Zelle', icon: '💸' },
  otro: { label: 'Otro', icon: '💳' },
};

const MANUAL_METHODS = ['binance', 'usdt_trc20', 'transferencia', 'wally', 'zinli', 'wise', 'skrill', 'pago_movil_usdt', 'zelle', 'otro'];

export default function QuoteFeePayment() {
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null); // { quote_number, quote_token }

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [shippingMark, setShippingMark] = useState('');
  const [notes, setNotes] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  // States from AdminSettings (StateConfig)
  const [states, setStates] = useState([]);

  // Payment state
  const [selectedMethod, setSelectedMethod] = useState('');
  const [paymentId, setPaymentId] = useState(null);
  const [stripeClientSecret, setStripeClientSecret] = useState(null);
  const [paypalApprovalUrl, setPaypalApprovalUrl] = useState(null);
  const [manualReference, setManualReference] = useState('');
  const [confirmingManual, setConfirmingManual] = useState(false);

  // PayPal return handler
  const [paypalReturnOrder, setPaypalReturnOrder] = useState(null);

  const loadConfig = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('getQuoteFeeConfig', {});
      const data = res.data || res;
      setConfig(data);
      if (data.enabled_methods && data.enabled_methods.length) {
        setSelectedMethod(data.enabled_methods[0]);
      }
    } catch (err) {
      console.error('Error loading config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStates = useCallback(async () => {
    try {
      const raw = await base44.entities.StateConfig.list('-state_name', 100);
      setStates(normalizeStates(raw));
    } catch (err) {
      console.error('Error loading states:', err);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadStates();

    // Check PayPal return params
    const params = new URLSearchParams(window.location.search);
    const paypalToken = params.get('token');
    const paypalReturn = params.get('paypal_return');
    if (paypalReturn && paypalToken) {
      setPaypalReturnOrder(paypalToken);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Debounced email lookup para shipping mark
  useEffect(() => {
    if (!email || !email.includes('@')) {
      setShippingMark('');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setLookupLoading(true);
        const res = await base44.functions.invoke('lookupQuoteClient', { email });
        const data = res.data || res;
        if (data.found && data.shipping_mark) {
          setShippingMark(data.shipping_mark);
        } else {
          setShippingMark('');
        }
      } catch (_) {
      } finally {
        setLookupLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [email]);

  // Confirm PayPal return
  useEffect(() => {
    if (!paypalReturnOrder || !config) return;
    (async () => {
      try {
        setConfirmingManual(true);
        const res = await base44.functions.invoke('confirmQuoteFeePayment', {
          paypal_order_id: paypalReturnOrder,
        });
        const data = res.data || res;
        if (data.error) throw new Error(data.error);
        setSuccess({ quote_number: data.quote_number, quote_token: data.quote_token });
      } catch (err) {
        toast({ title: 'Error al confirmar PayPal', description: err.message, variant: 'destructive' });
      } finally {
        setConfirmingManual(false);
        setPaypalReturnOrder(null);
      }
    })();
  }, [paypalReturnOrder, config]);

  const handleSubmit = async () => {
    if (!firstName || !lastName || !city || !phone || !email) {
      toast({ title: 'Completa todos los campos obligatorios', variant: 'destructive' });
      return;
    }
    if (!selectedMethod) {
      toast({ title: 'Selecciona un método de pago', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      const res = await base44.functions.invoke('createQuoteFeePayment', {
        client_first_name: firstName,
        client_last_name: lastName,
        client_city: city,
        client_phone: phone,
        client_email: email,
        shipping_mark: shippingMark,
        notes,
        method: selectedMethod,
      });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);

      setPaymentId(data.payment_id);

      if (selectedMethod === 'stripe' && data.stripe_client_secret) {
        setStripeClientSecret(data.stripe_client_secret);
      } else if (selectedMethod === 'paypal' && data.paypal_approval_url) {
        setPaypalApprovalUrl(data.paypal_approval_url);
      }
      // For manual methods, stay on the form and show the manual confirmation section
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStripeSuccess = async (paymentIntent) => {
    // El webhook de Stripe maneja el fulfill. Mostramos pantalla de éxito.
    setSuccess({ quote_number: null, quote_token: null, stripe_pending: true });
  };

  const handleManualConfirm = async () => {
    if (!paymentId) return;
    try {
      setConfirmingManual(true);
      const res = await base44.functions.invoke('confirmQuoteFeePayment', {
        payment_id: paymentId,
        payment_reference: manualReference,
      });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      setSuccess({ quote_number: data.quote_number, quote_token: data.quote_token });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setConfirmingManual(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
      </div>
    );
  }

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">¡Pago confirmado!</h1>
          {success.stripe_pending ? (
            <p className="text-sm text-gray-600">
              Tu pago está siendo procesado. Te enviaremos un correo a <strong>{email}</strong> con tu enlace de presupuesto en unos momentos.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Te enviamos un correo a <strong>{email}</strong> con tu enlace de presupuesto.
              </p>
              {success.quote_number && (
                <p className="text-sm text-gray-500 mb-4">
                  N° de presupuesto: <strong>{success.quote_number}</strong>
                </p>
              )}
              {success.quote_token && (
                <a href={`/Quote/${success.quote_token}`} className="inline-block">
                  <Button style={{ backgroundColor: '#800080' }} className="text-white hover:opacity-90">
                    Ir a mi presupuesto
                  </Button>
                </a>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // PayPal redirect screen
  if (paypalApprovalUrl) {
    window.location.href = paypalApprovalUrl;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Redirigiendo a PayPal...</p>
        </div>
      </div>
    );
  }

  const isManual = MANUAL_METHODS.includes(selectedMethod);
  const showManualForm = isManual && paymentId;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Header */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
          <h1 className="text-xl font-bold text-gray-800">Solicitar Presupuesto</h1>
          <p className="mt-1 text-sm text-gray-500">
            Completa tus datos y paga la tarifa de <strong>${(config?.amount || 20).toFixed(2)}</strong> para recibir tu enlace de presupuesto
          </p>
        </div>

        {/* Datos del Cliente */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-bold" style={{ color: '#800080' }}>Datos del Cliente</h3>
          <div className="mb-4 rounded-lg p-4 text-sm" style={{ backgroundColor: '#FFF9E6', border: '1px solid #FCE57E', color: '#A67C00' }}>
            Completa tus datos para que podamos generarte un enlace personalizado de presupuesto al confirmar el pago.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-gray-600">Nombre *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nombre" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Apellido *</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Estado de Despacho *</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecciona tu estado" />
                </SelectTrigger>
                <SelectContent>
                  {states.map((s) => (
                    <SelectItem key={s.state_code} value={s.state_name}>{s.state_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Número de Contacto (WhatsApp) *</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: 4121234567" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Email *</Label>
              <div className="relative mt-1">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="pr-10"
                />
                {lookupLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Shipping Mark</Label>
              {shippingMark ? (
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                  <Package className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-bold text-green-700">{shippingMark}</span>
                </div>
              ) : (
                <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="text-xs text-gray-400">Sin shipping mark asignado</span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-xs text-gray-600">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sin notas" className="mt-1" />
          </div>
        </div>

        {/* Método de Pago */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-bold" style={{ color: '#800080' }}>Método de Pago</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {(config?.enabled_methods || []).map((m) => {
              const info = METHOD_LABELS[m] || { label: m, icon: '💳' };
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMethod(m)}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all ${
                    selectedMethod === m
                      ? 'border-purple-400 bg-purple-50 font-semibold text-purple-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{info.icon}</span>
                  <span>{info.label}</span>
                </button>
              );
            })}
          </div>

          {/* Detalles del método manual seleccionado */}
          {isManual && config?.method_details?.[selectedMethod] && selectedMethod !== 'pago_movil_usdt' && (
            <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm">
              <p className="font-semibold text-gray-700 mb-2">Datos para el pago:</p>
              {config.method_details[selectedMethod].wallet && (
                <p className="text-gray-600 break-all">
                  <strong>{METHOD_LABELS[selectedMethod]?.label}:</strong> {config.method_details[selectedMethod].wallet}
                </p>
              )}
              {config.method_details[selectedMethod].instructions && (
                <p className="text-gray-500 mt-2 whitespace-pre-wrap">{config.method_details[selectedMethod].instructions}</p>
              )}
            </div>
          )}

          {/* Pago Móvil: 3 campos + monto en Bs */}
          {isManual && selectedMethod === 'pago_movil_usdt' && config?.method_details?.pago_movil_usdt && (
            <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-4">
              <p className="font-semibold text-gray-700 mb-3 text-sm">Datos para el pago:</p>
              <PagoMovilBsDisplay
                config={{
                  pago_movil_phone: config.method_details.pago_movil_usdt.phone,
                  pago_movil_bank: config.method_details.pago_movil_usdt.bank,
                  pago_movil_cedula: config.method_details.pago_movil_usdt.cedula,
                  bcv_eur_rate: config.bcv_eur_rate,
                  bcv_eur_rate_date: config.bcv_eur_rate_date,
                }}
                amountUsd={config?.amount || 20}
              />
              {config.method_details.pago_movil_usdt.instructions && (
                <p className="mt-3 text-gray-500 whitespace-pre-wrap text-sm">{config.method_details.pago_movil_usdt.instructions}</p>
              )}
            </div>
          )}

          {/* Resumen del monto */}
          <div className="mt-4 flex items-center justify-between rounded-lg bg-purple-50 border border-purple-200 px-4 py-3">
            <span className="text-sm font-medium text-gray-600">Tarifa de presupuesto</span>
            <span className="text-lg font-bold" style={{ color: '#800080' }}>${(config?.amount || 20).toFixed(2)}</span>
          </div>
        </div>

        {/* Stripe checkout inline */}
        {selectedMethod === 'stripe' && stripeClientSecret && config?.stripe_publishable_key && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-bold" style={{ color: '#800080' }}>Pagar con Tarjeta</h3>
            <StripeCheckout
              clientSecret={stripeClientSecret}
              publishableKey={config.stripe_publishable_key}
              onSuccess={handleStripeSuccess}
            />
          </div>
        )}

        {/* Manual confirmation form */}
        {showManualForm && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-2 text-sm font-bold" style={{ color: '#800080' }}>Confirmar Pago</h3>
            <p className="text-xs text-gray-500 mb-4">
              Realiza el pago usando los datos arriba y luego ingresa tu número de referencia para confirmar.
            </p>
            <Label className="text-xs text-gray-600">Referencia / N° de transacción</Label>
            <Input
              value={manualReference}
              onChange={(e) => setManualReference(e.target.value)}
              placeholder="Ej: TRANSF-123456"
              className="mt-1"
            />
            <Button
              onClick={handleManualConfirm}
              disabled={confirmingManual}
              style={{ backgroundColor: '#800080' }}
              className="w-full mt-4 text-white hover:opacity-90"
            >
              {confirmingManual ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirmando...</> : 'Confirmar Pago'}
            </Button>
          </div>
        )}

        {/* Submit button (before payment starts) */}
        {!paymentId && (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ backgroundColor: '#800080' }}
            className="w-full text-white hover:opacity-90"
          >
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</> : `Pagar $${(config?.amount || 20).toFixed(2)} y Recibir Enlace`}
          </Button>
        )}

        {/* PayPal redirect button (if order created but not yet redirected) */}
        {selectedMethod === 'paypal' && paypalApprovalUrl && (
          <Button
            onClick={() => window.location.href = paypalApprovalUrl}
            style={{ backgroundColor: '#0070ba' }}
            className="w-full text-white hover:opacity-90"
          >
            Ir a PayPal para completar el pago
          </Button>
        )}

        {confirmingManual && paypalReturnOrder && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Confirmando tu pago de PayPal...</p>
          </div>
        )}
      </div>
    </div>
  );
}