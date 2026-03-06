import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AssistedPaymentsList() {
  const [requests, setRequests] = React.useState([]);
  const [config, setConfig] = React.useState(null);
  const [savingCfg, setSavingCfg] = React.useState(false);

  const load = async () => {
    const [reqs, cfg] = await Promise.all([
      base44.entities.AssistedPaymentRequest.list('-created_date', 100),
      base44.entities.AppConfig.filter({ config_key: 'main' })
    ]);
    setRequests(reqs || []);
    setConfig(cfg?.[0] || null);
  };

  React.useEffect(() => { load(); }, []);

  const saveConfig = async () => {
    if (!config?.id) return;
    setSavingCfg(true);
    try {
      await base44.entities.AppConfig.update(config.id, {
        payments_assisted_enabled: !!config.payments_assisted_enabled,
        payments_assisted_fee_percentage: Number(config.payments_assisted_fee_percentage || 0),
        payments_assisted_instructions: config.payments_assisted_instructions || null
      });
      toast.success('Configuración guardada');
    } catch (e) { toast.error('No se pudo guardar'); }
    setSavingCfg(false);
  };

  const updateStatus = async (req, status) => {
    try {
      await base44.entities.AssistedPaymentRequest.update(req.id, { status });
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status } : r));
    } catch (e) { toast.error('No se pudo actualizar'); }
  };

  // Acciones administrativas
  const approveRequest = async (req) => {
    try {
      await base44.entities.AssistedPaymentRequest.update(req.id, { status: 'en_proceso' });
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'en_proceso' } : r));
      toast.success('Solicitud aprobada');

      // Crear (si no existe) una factura local para que el cliente la vea en "Mis Facturas"
      try {
        const invs = await base44.entities.Invoice.filter({ consolidation_id: `assisted:${req.id}` });
        if (!invs || invs.length === 0) {
          const total = Number(req.total_amount || 0);
          const nowIso = new Date().toISOString();
          const overdueDays = Number(config?.invoice_overdue_days || 7);
          const dueIso = new Date(Date.now() + (overdueDays * 24 * 60 * 60 * 1000)).toISOString();
          await base44.entities.Invoice.create({
            invoice_number: `AP-${req.id}-${Math.floor(Date.now()/1000)}`,
            client_email: req.client_email,
            consolidation_id: `assisted:${req.id}`,
            consolidation_tracking: `ASST-${String(req.id).slice(-6)}`,
            invoice_date: nowIso,
            due_date: dueIso,
            items: [{ description: 'Pago Asistido', quantity: 1, unit_price: total, total }],
            subtotal: total,
            tax: 0,
            total,
            status: 'pendiente',
            notes: `assisted_request_id:${req.id}`
          });
        }
      } catch (e) { console.error('No se pudo crear la factura local', e); }


    } catch (e) { toast.error('No se pudo aprobar'); }
  };

  const cancelApproval = async (req) => {
    try {
      // 1) Cancelar/voidear factura Stripe (si existiera) y notificar por email
      try {
        const resp = await base44.functions.invoke('cancelStripeAssistedInvoice', { assisted_request_id: req.id });
        if (resp?.data?.paid) {
          toast.warning('La factura ya estaba pagada en Stripe; no se puede cancelar');
        } else {
          toast.success('Factura cancelada y cliente notificado');
        }
      } catch (_) {
        // Continuar aunque falle Stripe; igual revertimos el estado
      }

      // 2) Revertir estado a Pendiente
      await base44.entities.AssistedPaymentRequest.update(req.id, { status: 'pendiente' });
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'pendiente' } : r));

      // 3) Dejar trazabilidad en comentario
      const note = `Aprobación cancelada el ${new Date().toLocaleString()}`;
      const admin_comment = [req.admin_comment, note].filter(Boolean).join(' | ');
      try { await base44.entities.AssistedPaymentRequest.update(req.id, { admin_comment }); } catch {}
      toast.success('Solicitud regresó a Pendiente');
    } catch (e) { toast.error('No se pudo cancelar'); }
  };

  const sendPaymentInstructions = async (req) => {
    if (!config) { toast.error('Config no cargada'); return; }

    // Lista de métodos disponibles y sus etiquetas legibles
    const methodsCatalog = [
      { code: 'binance', label: 'Binance' },
      { code: 'usdt_trc20', label: 'USDT (TRC20)' },
      { code: 'paypal', label: 'PayPal' },
      { code: 'debito_internacional', label: 'Débito Internacional' },
      { code: 'wally', label: 'Wally' },
      { code: 'zinli', label: 'Zinli' },
      { code: 'wise', label: 'Wise' },
      { code: 'skrill', label: 'Skrill' },
      { code: 'pago_movil_usdt', label: 'Pago Móvil USDT' },
    ];

    // Solo los métodos habilitados en configuración (cualquier valor distinto de false se considera activo)
    const active = methodsCatalog.filter(m => config[`payments_enable_${m.code}`] !== false);
    if (active.length === 0) { toast.error('No hay métodos de pago activos'); return; }

    const amountStr = (req.total_amount || 0).toFixed(2);
    const optionsStr = active.map((m, i) => `${i+1}) ${m.label} (${m.code})`).join('\n');
    const answer = window.prompt(
      `Selecciona el método de pago (escribe número o código):\n${optionsStr}\n\nMonto a pagar: $${amountStr} ${req.currency || 'USD'}`
    );
    if (!answer) return;

    // Permitir elegir por código o por número
    let selected = active.find(m => m.code.toLowerCase() === answer.trim().toLowerCase());
    if (!selected) {
      const idx = parseInt(answer, 10);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= active.length) selected = active[idx - 1];
    }
    if (!selected) { toast.error('Selección inválida'); return; }

    // Si es Débito/Crédito, crear factura Stripe y enviar enlace automáticamente
    if (selected.code === 'debito_internacional') {
      try {
        const resp = await base44.functions.invoke('createStripeAssistedInvoice', { assisted_request_id: req.id });
        const url = resp?.data?.hosted_invoice_url;
        toast.success('Factura Stripe creada y enviada');
        if (url) {
          console.log('Stripe invoice URL:', url);
        }
      } catch (e) {
        toast.error('No se pudo crear la factura en Stripe');
      }
      return;
    }

    // Guardar método seleccionado en la solicitud para mostrar al cliente
    try {
      await base44.entities.AssistedPaymentRequest.update(req.id, {
        payment_method: selected.code,
        payment_method_label: selected.label
      });
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, payment_method: selected.code, payment_method_label: selected.label } : r));
    } catch {}

    const method = selected.code;
    const wallet = config[`wallet_${method}`] || '';
    const instr = config[`${method}_instructions`] || config.payments_assisted_instructions || '';

    // Ensure a local invoice exists so the client sees it in "Mis Facturas"
    try {
      const invs = await base44.entities.Invoice.filter({ consolidation_id: `assisted:${req.id}` });
      if (!invs || invs.length === 0) {
        const nowIso = new Date().toISOString();
        const dueIso = new Date(Date.now() + (((config?.invoice_overdue_days || 7)) * 24 * 60 * 60 * 1000)).toISOString();
        await base44.entities.Invoice.create({
          invoice_number: `AP-${req.id}-${Math.floor(Date.now()/1000)}`,
          client_email: req.client_email,
          consolidation_id: `assisted:${req.id}`,
          consolidation_tracking: `ASST-${String(req.id).slice(-6)}`,
          invoice_date: nowIso,
          due_date: dueIso,
          items: [{ description: 'Pago Asistido', quantity: 1, unit_price: Number(req.total_amount || 0), total: Number(req.total_amount || 0) }],
          subtotal: Number(req.total_amount || 0),
          tax: 0,
          total: Number(req.total_amount || 0),
          status: 'pendiente',
          payment_method: method,
          notes: `assisted_request_id:${req.id}`
        });
      }
    } catch (e) { console.error('Invoice create error', e); }

    const body = [
      `Hola,`,
      `\nHemos aprobado tu solicitud de Pago Asistido y te compartimos las instrucciones para completar el pago.`,
      `\n\nResumen de la solicitud:`,
      `• Plataforma: ${req.provider?.toUpperCase() || '-'}\n• Enlace: ${req.link_url}\n• Monto base: $${(req.amount||0).toFixed(2)} ${req.currency||'USD'}\n• Comisión: $${(req.fee_amount||0).toFixed(2)} (${req.fee_percentage||0}%)\n• Total a pagar: $${(req.total_amount||0).toFixed(2)} ${req.currency||'USD'}`,
      `\n\nMétodo seleccionado: ${selected.label.toUpperCase()}`,
      wallet ? `\n• Cuenta/Wallet: ${wallet}` : '',
      instr ? `\n• Instrucciones: ${instr}` : '',
      `\n\nTras realizar el pago, por favor responde a este correo con la referencia y (si es posible) un enlace al comprobante.`,
      `\n\nGracias.\nEquipo TLEC CARGO`
    ].filter(Boolean).join('\n');

    try {
      await base44.integrations.Core.SendEmail({
        to: req.client_email,
        subject: 'Instrucciones de Pago Asistido',
        body
      });
      // Anotar en el registro
      const note = `Instrucciones enviadas por ${method} el ${new Date().toLocaleString()}`;
      const admin_comment = [req.admin_comment, note].filter(Boolean).join(' | ');
      await base44.entities.AssistedPaymentRequest.update(req.id, { admin_comment });
      toast.success('Instrucciones enviadas');
    } catch (e) { toast.error('No se pudo enviar el correo'); }
  };

  const confirmPaid = async (req) => {
    const reference = window.prompt('Referencia / comprobante (texto o número)');
    if (!reference) return;
    const proofUrl = window.prompt('URL del comprobante (opcional)') || '';
    const newComment = [req.admin_comment, proofUrl ? `Comprobante: ${proofUrl}` : null].filter(Boolean).join(' | ');

    try {
      await base44.entities.AssistedPaymentRequest.update(req.id, { status: 'pagado', reference: reference.trim(), admin_comment: newComment });
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'pagado', reference: reference.trim(), admin_comment: newComment } : r));

      const body = [
        `Hola,`,
        `\nTe confirmamos que TLEC CARGO ha realizado tu Pago Asistido.`,
        `\n\nResumen:`,
        `• Plataforma: ${req.provider?.toUpperCase() || '-'}\n• Enlace: ${req.link_url}\n• Total pagado: $${(req.total_amount||0).toFixed(2)} ${req.currency||'USD'}`,
        `• Referencia: ${reference.trim()}`,
        proofUrl ? `• Comprobante: ${proofUrl}` : '',
        `\n\nGracias por confiar en nosotros.`,
        `\n\nEquipo TLEC CARGO`
      ].filter(Boolean).join('\n');

      await base44.integrations.Core.SendEmail({
        to: req.client_email,
        subject: 'Confirmación de Pago Asistido',
        body
      });
      toast.success('Pago confirmado y correo enviado');
    } catch (e) { toast.error('No se pudo confirmar el pago'); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración • Pago Asistido</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Habilitado</Label>
            <div>
              <Switch checked={config?.payments_assisted_enabled !== false} onCheckedChange={(v) => setConfig(c => ({ ...(c||{}), payments_assisted_enabled: v }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Porcentaje (%)</Label>
            <Input type="number" min="0" step="0.1" value={config?.payments_assisted_fee_percentage ?? ''} onChange={(e) => setConfig(c => ({ ...(c||{}), payments_assisted_fee_percentage: e.target.value }))} />
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label>Instrucciones (opcional)</Label>
            <Input value={config?.payments_assisted_instructions || ''} onChange={(e) => setConfig(c => ({ ...(c||{}), payments_assisted_instructions: e.target.value }))} placeholder="Ej: Envíos superiores a $100 requieren confirmación" />
          </div>
          <div className="sm:col-span-3">
            <Button onClick={saveConfig} disabled={savingCfg} className="bg-blue-600 hover:bg-blue-700">{savingCfg ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Solicitudes</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-slate-500">Sin solicitudes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Fecha</th>
                    <th className="py-2 pr-4">Cliente</th>
                    <th className="py-2 pr-4">Plataforma</th>
                    <th className="py-2 pr-4">Enlace</th>
                    <th className="py-2 pr-4">Monto</th>
                    <th className="py-2 pr-4">Comisión</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Estado</th>
                    <th className="py-2 pr-4">Imagen</th>
                    <th className="py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id} className="border-b hover:bg-slate-50">
                      <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.created_date).toLocaleString()}</td>
                      <td className="py-2 pr-4">{r.client_email}</td>
                      <td className="py-2 pr-4 uppercase">{r.provider}</td>
                      <td className="py-2 pr-4 max-w-[280px]">
                        {r.link_url ? (
                          <a href={r.link_url} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all inline-block truncate max-w-[260px]">
                            {r.link_url}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-2 pr-4">${(r.amount||0).toFixed(2)}</td>
                      <td className="py-2 pr-4">${(r.fee_amount||0).toFixed(2)} ({r.fee_percentage || 0}%)</td>
                      <td className="py-2 pr-4 font-semibold">${(r.total_amount||0).toFixed(2)}</td>
                      <td className="py-2 pr-4">
                        <Select value={r.status} onValueChange={(v) => updateStatus(r, v)}>
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendiente">Pendiente</SelectItem>
                            <SelectItem value="en_proceso">En proceso</SelectItem>
                            <SelectItem value="pagado">Pagado</SelectItem>
                            <SelectItem value="rechazado">Rechazado</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 pr-4">
                        {r.image_url ? (
                          <a href={r.image_url} target="_blank" rel="noreferrer" title="Abrir imagen en nueva pestaña">
                            <img src={r.image_url} alt="Soporte" className="h-10 w-10 object-cover rounded border" />
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex flex-wrap gap-2">
                          {r.status === 'en_proceso' ? (
                            <Button size="sm" variant="destructive" onClick={() => cancelApproval(r)}>Cancelar factura</Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => approveRequest(r)}>Aprobar</Button>
                          )}
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => confirmPaid(r)}>Confirmar pago</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}