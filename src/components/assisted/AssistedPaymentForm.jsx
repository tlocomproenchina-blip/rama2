import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { logActionAudit } from '@/lib/actionAudit';

export default function AssistedPaymentForm({ user }) {
  const [config, setConfig] = React.useState(null);
  const [link, setLink] = React.useState('');
  const [provider, setProvider] = React.useState('otro');
  const [amount, setAmount] = React.useState('');
  const [imageUrl, setImageUrl] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const percent = Number(config?.payments_assisted_fee_percentage ?? 5);

  React.useEffect(() => {
    (async () => {
      const cfg = await base44.entities.AppConfig.filter({ config_key: 'main' });
      setConfig(cfg?.[0] || null);
    })();
  }, []);

  const autoDetectProvider = (url) => {
    if (!url) return 'otro';
    const u = url.toLowerCase();
    if (u.includes('alibaba') || u.includes('1688')) return 'alibaba';
    if (u.includes('wechat')) return 'wechat';
    if (u.includes('alipay')) return 'alipay';
    return 'otro';
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);
      if (link) setLink('');
      toast.success('QR cargado');
    } catch (e) {
      toast.error('No se pudo cargar el QR');
    }
  };

  const calc = () => {
    const amt = Number(amount || 0);
    const p = Number(percent || 0);
    const feeAmt = Math.round(amt * (p / 100) * 100) / 100; // comisión = monto * (porcentaje/100), redondeado a 2 decimales
    const total = Math.round((amt + feeAmt) * 100) / 100;
    return { feeAmt, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((!link && !imageUrl) || !amount) {
      toast.error('Ingresa enlace o sube un QR, y el monto');
      return;
    }
    const { feeAmt, total } = calc();
    setSubmitting(true);
    try {
      await base44.entities.AssistedPaymentRequest.create({
        client_email: user.email,
        link_url: link,
        provider: provider || autoDetectProvider(link),
        amount: Number(amount),
        currency: 'USD',
        fee_percentage: percent,
        fee_amount: feeAmt,
        total_amount: total,
        image_url: imageUrl || undefined,
        notes: notes || undefined,
        status: 'pendiente'
      });
      toast.success('Solicitud enviada');
      setLink(''); setAmount(''); setImageUrl(''); setNotes('');
    } catch (e) {
      toast.error('No se pudo enviar la solicitud');
    }
    setSubmitting(false);
  };

  const { feeAmt, total } = calc();

  const enabled = config?.payments_assisted_enabled !== false;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pago Asistido</CardTitle>
          <CardDescription>
            Comisión actual: {percent}%{config?.payments_assisted_instructions ? ` • ${config.payments_assisted_instructions}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!enabled && (
            <div className="p-3 rounded-md bg-amber-50 text-amber-700 text-sm">
              El Pago Asistido está deshabilitado temporalmente.
            </div>
          )}

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <h3 className="text-sm font-semibold text-blue-900">Instrucciones de uso</h3>
            <ol className="mt-2 space-y-1 text-sm text-blue-900/80 list-decimal pl-4">
              <li>Pega el enlace del producto o sube el QR de WeChat o Alipay.</li>
              <li>Indica el monto exacto a pagar en USD.</li>
              <li>Selecciona la plataforma correspondiente.</li>
              <li>Agrega notas si necesitas especificar color, talla o detalles de compra.</li>
              <li>Revisa el cálculo estimado y luego pulsa <span className="font-medium">Enviar solicitud</span>.</li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label>Enlace (si no subes QR)</Label>
            <Input
              value={link}
              onChange={(e) => { const v = e.target.value; setLink(v); setProvider(autoDetectProvider(v)); if (v) setImageUrl(''); }}
              placeholder="Pega aquí el enlace del producto (si no subes QR)"
              type="url"
              required={!imageUrl}
              disabled={!enabled || !!imageUrl}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monto a pagar (USD)</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" required disabled={!enabled} />
            </div>
            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select value={provider} onValueChange={setProvider} disabled={!enabled}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alibaba">Alibaba</SelectItem>
                  <SelectItem value="wechat">WeChat</SelectItem>
                  <SelectItem value="alipay">Alipay</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>QR WeChat o Alipay (si no colocas enlace)</Label>
            <Input type="file" accept="image/*" onChange={handleFile} disabled={!enabled || !!link} />
            {imageUrl && (
              <img src={imageUrl} alt="QR" className="mt-2 h-28 w-auto rounded-md border object-cover" />
            )}
          </div>

          <div className="rounded-lg border p-4 bg-slate-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-sm text-slate-600">Cálculo estimado</p>
              <div className="text-sm text-slate-700">
                Comisión ({percent}%): <span className="font-semibold">${feeAmt.toFixed(2)}</span>
                <span className="mx-2">•</span>
                Total a pagar: <span className="font-semibold text-slate-900">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Color, talla, instrucciones, etc." disabled={!enabled} />
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={!enabled || submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Enviando...' : 'Enviar solicitud'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}