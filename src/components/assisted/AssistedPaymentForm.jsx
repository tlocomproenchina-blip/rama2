import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { logActionAudit } from '@/lib/actionAudit';
import { Plus, Trash2 } from 'lucide-react';

const emptyItem = () => ({
  link: '',
  amount: '',
  provider: 'otro',
  imageUrl: '',
});

export default function AssistedPaymentForm({ user }) {
  const [config, setConfig] = React.useState(null);
  const [items, setItems] = React.useState([emptyItem()]);
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

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const handleLinkChange = (idx, v) => {
    updateItem(idx, { link: v, provider: autoDetectProvider(v), ...(v ? { imageUrl: '' } : {}) });
  };

  const handleFile = async (idx, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      updateItem(idx, { imageUrl: file_url, ...(file_url ? { link: '' } : {}) });
      toast.success('QR cargado');
    } catch (err) {
      toast.error('No se pudo cargar el QR');
    }
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const calcItem = (it) => {
    const amt = Number(it.amount || 0);
    const p = Number(percent || 0);
    const feeAmt = Math.round(amt * (p / 100) * 100) / 100;
    const total = Math.round((amt + feeAmt) * 100) / 100;
    return { feeAmt, total };
  };

  const totals = items.reduce(
    (acc, it) => {
      const { feeAmt, total } = calcItem(it);
      acc.feeAmt += feeAmt;
      acc.total += total;
      return acc;
    },
    { feeAmt: 0, total: 0 }
  );
  totals.feeAmt = Math.round(totals.feeAmt * 100) / 100;
  totals.total = Math.round(totals.total * 100) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const valid = items.filter((it) => (it.link || it.imageUrl) && it.amount);
    if (valid.length === 0) {
      toast.error('Agrega al menos un enlace o QR con su monto');
      return;
    }
    setSubmitting(true);
    const submissionId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      for (const it of valid) {
        const { feeAmt, total } = calcItem(it);
        const requestNumber = `AP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const request = await base44.entities.AssistedPaymentRequest.create({
          client_email: user.email,
          submission_id: submissionId,
          request_number: requestNumber,
          link_url: it.link,
          provider: it.provider || autoDetectProvider(it.link),
          amount: Number(it.amount),
          currency: 'USD',
          fee_percentage: percent,
          fee_amount: feeAmt,
          total_amount: total,
          image_url: it.imageUrl || undefined,
          notes: notes || undefined,
          status: 'pendiente'
        });
        await logActionAudit(base44, user, {
          target_email: user?.email,
          target_name: user?.full_name || user?.email,
          action_type: 'create_assisted_payment_request',
          module_name: 'AssistedPayment',
          reference_id: request?.id,
          area_name: 'Operaciones',
          summary: `Generó solicitud de pago asistido por $${total.toFixed(2)}`,
          details: `Plataforma: ${it.provider || autoDetectProvider(it.link)} · Enlace: ${it.link || 'sin enlace'} · QR: ${it.imageUrl || 'sin QR'}`,
          changed_fields: ['provider', 'amount', 'fee_amount', 'total_amount'],
        });

        base44.functions.invoke('listAdmins', {}).then(r => (r?.data?.admins) || []).then(admins => {
          const providerLabel = it.provider || autoDetectProvider(it.link);
          admins.forEach(admin => {
            base44.entities.Notification.create({
              user_email: admin.email,
              title: '🛒 Nueva Solicitud de Pago Asistido',
              message: `${user.email} solicitó pago asistido por $${total.toFixed(2)} (${providerLabel})`,
              type: 'assisted_payment',
              icon: 'dollar',
              reference_id: request?.id
            }).catch(err => console.error('Notification error:', err));
          });
        }).catch(err => console.error('Admin fetch error:', err));
      }

      toast.success(`${valid.length} solicitud(es) enviada(s) · Total $${totals.total.toFixed(2)}`);
      setItems([emptyItem()]);
      setNotes('');
    } catch (err) {
      toast.error('No se pudo enviar la solicitud');
    }
    setSubmitting(false);
  };

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
              <li>Usa el botón <span className="font-medium">+</span> para agregar varios enlaces en una sola solicitud.</li>
              <li>Agrega notas si necesitas especificar color, talla o detalles de compra.</li>
              <li>Revisa el total estimado y luego pulsa <span className="font-medium">Enviar solicitud</span>.</li>
            </ol>
          </div>

          <div className="space-y-4">
            {items.map((it, idx) => {
              const { feeAmt, total } = calcItem(it);
              return (
                <div key={idx} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Enlace #{idx + 1}</span>
                    {items.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-rose-600 hover:text-rose-700 h-8 px-2">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Enlace (si no subes QR)</Label>
                    <Input
                      value={it.link}
                      onChange={(e) => handleLinkChange(idx, e.target.value)}
                      placeholder="Pega aquí el enlace del producto (si no subes QR)"
                      type="url"
                      required={!it.imageUrl}
                      disabled={!enabled || !!it.imageUrl}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Monto a pagar (USD)</Label>
                      <Input
                        value={it.amount}
                        onChange={(e) => updateItem(idx, { amount: e.target.value })}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        required
                        disabled={!enabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Plataforma</Label>
                      <Select value={it.provider} onValueChange={(v) => updateItem(idx, { provider: v })} disabled={!enabled}>
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
                    <Input type="file" accept="image/*" onChange={(e) => handleFile(idx, e)} disabled={!enabled || !!it.link} />
                    {it.imageUrl && (
                      <img src={it.imageUrl} alt="QR" className="mt-2 h-28 w-auto rounded-md border object-cover" />
                    )}
                  </div>

                  <div className="rounded-lg border p-3 bg-slate-50 text-sm text-slate-700">
                    Comisión ({percent}%): <span className="font-semibold">${feeAmt.toFixed(2)}</span>
                    <span className="mx-2">•</span>
                    Subtotal: <span className="font-semibold text-slate-900">${total.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <Button type="button" variant="outline" onClick={addItem} disabled={!enabled} className="gap-2">
            <Plus className="h-4 w-4" /> Agregar otro enlace
          </Button>

          <div className="rounded-lg border-2 border-blue-200 p-4 bg-blue-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-sm font-semibold text-blue-900">Total estimado ({items.length} enlace{items.length !== 1 ? 's' : ''})</p>
              <div className="text-sm text-slate-700">
                Comisión total: <span className="font-semibold">${totals.feeAmt.toFixed(2)}</span>
                <span className="mx-2">•</span>
                Total a pagar: <span className="font-bold text-blue-900 text-base">${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Color, talla, instrucciones, etc." disabled={!enabled} />
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={!enabled || submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? 'Enviando...' : `Enviar ${items.length} solicitud${items.length !== 1 ? 'es' : ''}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}