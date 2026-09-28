import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Copy, Check, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ALL_METHODS = [
  { key: 'paypal', label: 'PayPal' },
  { key: 'binance', label: 'Binance Pay' },
  { key: 'usdt_trc20', label: 'USDT TRC20' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'wally', label: 'Wally' },
  { key: 'zinli', label: 'Zinli' },
  { key: 'wise', label: 'Wise' },
  { key: 'skrill', label: 'Skrill' },
  { key: 'pago_movil_usdt', label: 'Pago Móvil USDT' },
  { key: 'zelle', label: 'Zelle' },
  { key: 'otro', label: 'Otro' },
];

export default function QuoteFeeConfigCard({ config, onSaved }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(config?.quote_fee_amount ?? 20);
  const [enabledMethods, setEnabledMethods] = useState(
    Array.isArray(config?.quote_fee_enabled_methods) && config.quote_fee_enabled_methods.length
      ? config.quote_fee_enabled_methods
      : ['paypal']
  );
  const [emailSubject, setEmailSubject] = useState(config?.quote_fee_email_subject || '🎉 Tu enlace de presupuesto está listo');
  const [emailBody, setEmailBody] = useState(
    config?.quote_fee_email_body ||
      'Hola {cliente_nombre},\n\n¡Gracias por tu pago! Tu solicitud de presupuesto fue recibida.\n\nN° de presupuesto: {numero_presupuesto}\n\nCompleta tus productos en el siguiente enlace:\n{enlace_presupuesto}\n\nTLEC CARGO'
  );
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleMethod = (key) => {
    setEnabledMethods((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await base44.entities.AppConfig.update(config.id, {
        quote_fee_amount: Number(amount) || 20,
        quote_fee_enabled_methods: enabledMethods,
        quote_fee_email_subject: emailSubject,
        quote_fee_email_body: emailBody,
      });
      onSaved?.(updated);
      toast({ title: 'Configuración guardada' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/QuoteFeePayment`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Enlace copiado', description: url });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold" style={{ color: '#800080' }}>Tarifa de Presupuesto</h3>
          <p className="text-xs text-gray-500">Configura el cobro por generar un presupuesto</p>
        </div>
        <Button variant="outline" onClick={handleCopyLink} className="gap-2">
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          Copiar Enlace de Pago
        </Button>
      </div>

      {/* Enlace universal */}
      <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 flex items-center gap-2">
        <LinkIcon className="h-4 w-4 text-purple-600 shrink-0" />
        <code className="text-xs text-purple-700 break-all">{window.location.origin}/QuoteFeePayment</code>
      </div>

      {/* Monto */}
      <div>
        <Label className="text-xs text-gray-600">Monto de la tarifa (USD)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 max-w-[160px]"
        />
      </div>

      {/* Métodos habilitados */}
      <div>
        <Label className="text-xs text-gray-600 mb-2 block">Métodos de pago aceptados</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {ALL_METHODS.map((m) => (
            <label
              key={m.key}
              className={`flex items-center gap-2 rounded-lg border p-2 text-xs cursor-pointer transition-all ${
                enabledMethods.includes(m.key)
                  ? 'border-purple-400 bg-purple-50 text-purple-700 font-medium'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              <input
                type="checkbox"
                checked={enabledMethods.includes(m.key)}
                onChange={() => toggleMethod(m.key)}
                className="accent-purple-600"
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      {/* Email template */}
      <div>
        <Label className="text-xs text-gray-600">Asunto del email al cliente</Label>
        <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label className="text-xs text-gray-600">Cuerpo del email</Label>
        <Textarea
          value={emailBody}
          onChange={(e) => setEmailBody(e.target.value)}
          className="mt-1 font-mono text-xs"
          rows={6}
        />
        <p className="mt-1 text-xs text-gray-400">
          Placeholders: {'{cliente_nombre}'}, {'{numero_presupuesto}'}, {'{enlace_presupuesto}'}
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#800080' }} className="text-white hover:opacity-90">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Guardar Configuración
        </Button>
      </div>
    </div>
  );
}