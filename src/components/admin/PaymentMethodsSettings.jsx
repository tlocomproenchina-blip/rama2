import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PaymentMethodCard from '@/components/admin/PaymentMethodCard';
import {
  ArrowRightLeft,
  Banknote,
  CreditCard,
  DollarSign,
  Landmark,
  Loader2,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';

const methodGroups = [
  {
    title: 'Cobro online y tarjetas',
    description: 'Métodos digitales listos para clientes que pagan desde web o con soporte manual.',
    methods: [
      {
        key: 'stripe',
        title: 'Stripe (Tarjeta)',
        description: 'Cobro con tarjeta y validación de configuración de Stripe.',
        enabledKey: 'payments_enable_stripe',
        tone: 'purple',
        icon: CreditCard,
        instructionsKey: 'debito_internacional_instructions',
        identityKey: 'wallet_debito_internacional',
        identityLabel: 'Datos visibles al cliente',
        identityPlaceholder: 'Datos para débito internacional o referencia adicional',
        instructionsPlaceholder: 'Indicaciones para pagos manuales o soporte adicional',
        stripe: true,
      },
      {
        key: 'paypal',
        title: 'PayPal',
        description: 'Recibe pagos con correo PayPal y agrega instrucciones claras al cliente.',
        enabledKey: 'payments_enable_paypal',
        tone: 'indigo',
        icon: Wallet,
        identityKey: 'wallet_paypal',
        identityLabel: 'Email de PayPal',
        identityPlaceholder: 'tu-email@paypal.com',
        instructionsKey: 'paypal_instructions',
        instructionsPlaceholder: 'Indicaciones para el pago por PayPal',
      },
    ],
  },
  {
    title: 'Wallets y cripto',
    description: 'Organiza tus direcciones más usadas y mantenlas activas solo cuando estén listas para recibir pagos.',
    methods: [
      {
        key: 'binance',
        title: 'Binance',
        description: 'Ideal para cobros rápidos con referencia o memo.',
        enabledKey: 'payments_enable_binance',
        tone: 'amber',
        icon: DollarSign,
        identityKey: 'wallet_binance',
        identityLabel: 'Dirección de Wallet',
        identityPlaceholder: 'Dirección de wallet Binance',
        instructionsKey: 'binance_instructions',
        instructionsPlaceholder: 'Ejemplo: incluye tu Shipping Mark en el memo',
      },
      {
        key: 'usdt',
        title: 'USDT TRC20',
        description: 'Úsalo cuando necesites una wallet estable y red específica.',
        enabledKey: 'payments_enable_usdt_trc20',
        tone: 'blue',
        icon: ShieldCheck,
        identityKey: 'wallet_usdt_trc20',
        identityLabel: 'Dirección de Wallet',
        identityPlaceholder: 'Dirección de wallet USDT TRC20',
        instructionsKey: 'usdt_instructions',
        instructionsPlaceholder: 'Asegúrate de indicar red TRC20 y monto exacto',
      },
    ],
  },
  {
    title: 'Métodos alternativos',
    description: 'Opciones regionales y billeteras complementarias para distintos perfiles de cliente.',
    methods: [
      {
        key: 'wally',
        title: 'Wally',
        description: 'Comparte usuario o teléfono y deja pasos simples para confirmar el pago.',
        enabledKey: 'payments_enable_wally',
        tone: 'amber',
        icon: Landmark,
        identityKey: 'wallet_wally',
        identityLabel: 'Usuario / Teléfono Wally',
        identityPlaceholder: 'Usuario o teléfono Wally',
        instructionsKey: 'wally_instructions',
        instructionsPlaceholder: 'Instrucciones para el cliente',
      },
      {
        key: 'zinli',
        title: 'Zinli',
        description: 'Útil para clientes que operan con tarjeta o saldo Zinli.',
        enabledKey: 'payments_enable_zinli',
        tone: 'blue',
        icon: CreditCard,
        identityKey: 'wallet_zinli',
        identityLabel: 'Usuario / Teléfono Zinli',
        identityPlaceholder: 'Usuario o teléfono Zinli',
        instructionsKey: 'zinli_instructions',
        instructionsPlaceholder: 'Instrucciones para el cliente',
      },
      {
        key: 'wise',
        title: 'Wise',
        description: 'Configura correo o datos bancarios visibles para transferencias internacionales.',
        enabledKey: 'payments_enable_wise',
        tone: 'indigo',
        icon: ArrowRightLeft,
        identityKey: 'wallet_wise',
        identityLabel: 'Email / Datos Wise',
        identityPlaceholder: 'Email o datos Wise',
        instructionsKey: 'wise_instructions',
        instructionsPlaceholder: 'Instrucciones para el cliente',
      },
      {
        key: 'skrill',
        title: 'Skrill',
        description: 'Método alternativo para clientes que prefieren saldo digital.',
        enabledKey: 'payments_enable_skrill',
        tone: 'purple',
        icon: Wallet,
        identityKey: 'wallet_skrill',
        identityLabel: 'Email Skrill',
        identityPlaceholder: 'tu-email@skrill.com',
        instructionsKey: 'skrill_instructions',
        instructionsPlaceholder: 'Instrucciones para el cliente',
      },
      {
        key: 'zelle',
        title: 'Zelle',
        description: 'Muestra el correo o teléfono de recepción para transferencias rápidas.',
        enabledKey: 'payments_enable_zelle',
        tone: 'emerald',
        icon: Banknote,
        identityKey: 'wallet_zelle',
        identityLabel: 'Email / Teléfono Zelle',
        identityPlaceholder: 'Email o teléfono Zelle',
        instructionsKey: 'zelle_instructions',
        instructionsPlaceholder: 'Instrucciones para el cliente',
      },
      {
        key: 'pago_movil',
        title: 'Pago Móvil → USDT',
        description: 'Combina referencia local con instrucciones de conversión o validación.',
        enabledKey: 'payments_enable_pago_movil_usdt',
        tone: 'blue',
        icon: Banknote,
        identityKey: 'wallet_pago_movil_usdt',
        identityLabel: 'Datos de pago',
        identityPlaceholder: 'Teléfono o datos de conversión',
        instructionsKey: 'pago_movil_usdt_instructions',
        instructionsPlaceholder: 'Instrucciones para el cliente',
      },
    ],
  },
];

export default function PaymentMethodsSettings({ config, setConfig, saving, onSave }) {
  const [openCards, setOpenCards] = useState({ stripe: true, binance: true, paypal: true });
  const [checkingStripe, setCheckingStripe] = useState(false);
  const [stripeCheckResult, setStripeCheckResult] = useState(null);

  const visibleMethods = useMemo(() => methodGroups.flatMap((group) => group.methods), []);
  const activeCount = visibleMethods.filter((method) => !!config?.[method.enabledKey]).length;

  const updateField = (key, value) => setConfig((prev) => ({ ...prev, [key]: value }));
  const toggleCard = (key) => setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleStripeCheck = async () => {
    setCheckingStripe(true);
    setStripeCheckResult(null);
    try {
      const res = await base44.functions.invoke('getStripeConfig');
      if (res.status === 200 && res.data?.publishableKey) {
        setStripeCheckResult({ type: 'success', message: 'Stripe está configurado correctamente.' });
        toast.success('Stripe está configurado correctamente');
      } else {
        setStripeCheckResult({ type: 'error', message: 'Falta configurar la clave pública de Stripe.' });
        toast.error('Falta configurar la clave pública de Stripe');
      }
    } catch (_) {
      setStripeCheckResult({ type: 'error', message: 'No se pudo verificar Stripe en este momento.' });
      toast.error('No se pudo verificar Stripe');
    } finally {
      setCheckingStripe(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <CardHeader className="pb-3 px-4 pt-4 md:pb-4 md:px-6 md:pt-6">
          <CardTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="h-5 w-5" />
            Panel de pagos
          </CardTitle>
          <CardDescription className="text-slate-300">
            Organiza tus métodos en tarjetas plegables, activa solo los necesarios y deja instrucciones más claras para tu equipo y tus clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 px-4 pb-4 md:grid-cols-3 md:px-6 md:pb-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-300">Métodos activos</p>
            <p className="mt-2 text-3xl font-semibold">{activeCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-300">Tarjetas y online</p>
            <p className="mt-2 text-base font-medium">Stripe y PayPal</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-300">Recomendación</p>
            <p className="mt-2 text-base font-medium">Mantén visibles solo los métodos realmente operativos.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Reglas de sincronización con Stripe</CardTitle>
          <CardDescription>
            Define cómo se comporta el sistema cuando marcas facturas como pagadas o sincronizas datos con Stripe.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Sincronización al marcar pagada</Label>
            <Select value={config?.payments_stripe_sync_mode || 'auto'} onValueChange={(value) => updateField('payments_stripe_sync_mode', value)}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático</SelectItem>
                <SelectItem value="confirm">Pedir confirmación</SelectItem>
                <SelectItem value="button">Botón separado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Detalles guardados en Stripe</Label>
            <Select value={config?.payments_stripe_details_mode || 'none'} onValueChange={(value) => updateField('payments_stripe_details_mode', value)}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguno</SelectItem>
                <SelectItem value="metadata">Metadata</SelectItem>
                <SelectItem value="description">Descripción</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Si Stripe falla</Label>
            <Select value={config?.payments_stripe_error_mode || 'keep_and_alert'} onValueChange={(value) => updateField('payments_stripe_error_mode', value)}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="keep_and_alert">Mantener y alertar</SelectItem>
                <SelectItem value="revert">Revertir</SelectItem>
                <SelectItem value="retry_then_revert">Reintentar y revertir</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {methodGroups.map((group) => (
        <div key={group.title} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{group.title}</h3>
              <p className="text-sm text-slate-500">{group.description}</p>
            </div>
            <Badge variant="outline" className="hidden sm:inline-flex">
              {group.methods.filter((method) => !!config?.[method.enabledKey]).length} activos
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.methods.map((method) => (
              <PaymentMethodCard
                key={method.key}
                title={method.title}
                description={method.description}
                icon={method.icon}
                tone={method.tone}
                enabled={!!config?.[method.enabledKey]}
                onEnabledChange={(checked) => updateField(method.enabledKey, checked)}
                open={!!openCards[method.key]}
                onToggleOpen={() => toggleCard(method.key)}
                identityLabel={method.identityLabel}
                identityValue={config?.[method.identityKey]}
                onIdentityChange={method.identityKey ? (value) => updateField(method.identityKey, value) : undefined}
                identityPlaceholder={method.identityPlaceholder}
                instructionsValue={config?.[method.instructionsKey]}
                onInstructionsChange={method.instructionsKey ? (value) => updateField(method.instructionsKey, value) : undefined}
                instructionsPlaceholder={method.instructionsPlaceholder}
              >
                {method.stripe && (
                  <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">Estado de Stripe</p>
                        <p className="text-sm text-slate-600">Las claves viven en el servidor. Desde aquí puedes comprobar si todo está listo.</p>
                      </div>
                      <Button type="button" variant="outline" onClick={handleStripeCheck} className="bg-white" disabled={checkingStripe}>
                        {checkingStripe ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</> : 'Probar Stripe'}
                      </Button>
                    </div>
                    {stripeCheckResult && (
                      <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${stripeCheckResult.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                        {stripeCheckResult.message}
                      </div>
                    )}
                  </div>
                )}
              </PaymentMethodCard>
            ))}
          </div>
        </div>
      ))}

      <div className="sticky bottom-4 z-10">
        <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-slate-900">¿Listo para publicar cambios?</p>
              <p className="text-sm text-slate-500">Guarda cuando termines de ordenar y actualizar tus métodos de pago.</p>
            </div>
            <Button onClick={onSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar configuración de pagos'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}