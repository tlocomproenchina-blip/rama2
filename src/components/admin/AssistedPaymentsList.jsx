import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { base44 } from '@/components/api/ApiQueueManager';
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
      if (status === 'en_proceso' && !req.invoice_id) {
        const res = await base44.functions.invoke('createAssistedPaymentInvoice', { request_id: req.id });
        const invId = res?.data?.invoice_id;
        await base44.entities.AssistedPaymentRequest.update(req.id, { status, invoice_id: invId });
        setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status, invoice_id: invId } : r));
        toast.success('Factura generada y enviada al cliente');
        return;
      }

      if (status === 'rechazado' && req.invoice_id) {
        await base44.entities.Invoice.delete(req.invoice_id);
        await base44.entities.AssistedPaymentRequest.update(req.id, { status, invoice_id: null });
        setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status, invoice_id: null } : r));
        toast.success('Solicitud rechazada y factura eliminada');
        return;
      }

      await base44.entities.AssistedPaymentRequest.update(req.id, { status });
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status } : r));
    } catch (e) { toast.error('No se pudo actualizar'); }
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
            <div className="space-y-4">
              {requests.map(r => (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Fecha</p>
                      <p className="mt-1 text-sm text-slate-800 break-words">{new Date(r.created_date).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cliente</p>
                      <p className="mt-1 text-sm text-slate-800 break-all">{r.client_email}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Plataforma</p>
                      <p className="mt-1 text-sm text-slate-800 uppercase">{r.provider}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Enlace</p>
                      <div className="mt-1 text-sm">
                        {r.link_url ? (
                          <a href={r.link_url} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">Abrir enlace</a>
                        ) : '—'}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">QR</p>
                      <div className="mt-1">
                        {r.image_url ? (
                          <a href={r.image_url} target="_blank" rel="noreferrer" title="Ver QR">
                            <img src={r.image_url} alt="QR" className="h-14 w-14 object-cover rounded border bg-white" />
                          </a>
                        ) : '—'}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Factura</p>
                      <p className="mt-1 text-sm text-slate-800 break-all">{r.invoice_id || '—'}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Monto</p>
                      <p className="mt-1 text-sm text-slate-800">${(r.amount||0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Comisión</p>
                      <p className="mt-1 text-sm text-slate-800">${(r.fee_amount||0).toFixed(2)} ({r.fee_percentage || 0}%)</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total</p>
                      <p className="mt-1 text-base font-semibold text-slate-900">${(r.total_amount||0).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Estado</p>
                      <p className="mt-1 text-sm text-slate-800">
                        {r.status === 'en_proceso' && r.invoice_id ? 'Pago pendiente' : ({
                          pendiente: 'Pendiente',
                          en_proceso: 'En proceso',
                          pagado: 'Pagado',
                          rechazado: 'Rechazado',
                        }[r.status] || r.status)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        size="sm"
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => updateStatus(r, 'en_proceso')}
                        disabled={r.status === 'en_proceso' || r.status === 'pagado' || r.status === 'rechazado'}
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full sm:w-auto"
                        onClick={() => updateStatus(r, 'rechazado')}
                        disabled={r.status === 'rechazado' || r.status === 'pagado'}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}