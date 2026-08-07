import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { Link2, ExternalLink, Search, Hash, MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl } from '@/lib/whatsappContact';

const providerLabels = {
  alibaba: 'Alibaba',
  wechat: 'WeChat',
  alipay: 'Alipay',
  otro: 'Otro'
};

export default function AssistedPaymentsList() {
  const [requests, setRequests] = React.useState([]);
  const [config, setConfig] = React.useState(null);
  const [savingCfg, setSavingCfg] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [clientsMap, setClientsMap] = React.useState({});

  const load = async () => {
    const [reqs, cfg] = await Promise.all([
      base44.entities.AssistedPaymentRequest.list('-created_date', 100),
      base44.entities.AppConfig.filter({ config_key: 'main' })
    ]);
    setRequests(reqs || []);
    setConfig(cfg?.[0] || null);

    // Obtener solo los clientes relacionados (evita listar todos los usuarios)
    const emails = Array.from(new Set((reqs || []).map(r => r.client_email).filter(Boolean)));
    let map = {};
    if (emails.length) {
      try {
        const res = await base44.functions.invoke('getClientsByEmails', { emails });
        const clientsObj = res?.data?.clients || res?.clients || {};
        const clientsArr = Array.isArray(clientsObj) ? clientsObj : Object.values(clientsObj);
        clientsArr.forEach((c) => { if (c?.email) map[c.email.toLowerCase()] = c; });
      } catch (_) {}
    }
    setClientsMap(map);
  };

  const buildAssistedPaymentMessage = (requestNumber, clientName) => {
    const id = requestNumber || '';
    const greeting = clientName ? `Hola ${clientName},` : 'Hola,';
    return `${greeting} le escribimos de TLEC CARGO en relación a su solicitud de pago asistido${id ? ` número ${id}` : ''}.`;
  };

  const getWhatsAppUrl = (email, requestNumber) => {
    const client = clientsMap[(email || '').toLowerCase()];
    const wa = client?.whatsapp || client?.phone || '';
    const fullName = [client?.first_name, client?.last_name].filter(Boolean).join(' ');
    return buildWhatsAppUrl(wa, buildAssistedPaymentMessage(requestNumber, fullName));
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
        toast.success('Factura generada · el cliente puede pagar con los métodos habilitados');
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

  // Filtrar por búsqueda (ID, cliente, plataforma, enlace, estado)
  const filteredRequests = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      (r.request_number || '').toLowerCase().includes(q) ||
      (r.client_email || '').toLowerCase().includes(q) ||
      (r.provider || '').toLowerCase().includes(q) ||
      (r.link_url || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q)
    );
  }, [requests, query]);

  // Agrupar solicitudes: por submission_id si existe, sino individuales
  const groups = React.useMemo(() => {
    const map = new Map();
    const standalone = [];
    for (const r of filteredRequests) {
      if (r.submission_id) {
        if (!map.has(r.submission_id)) map.set(r.submission_id, []);
        map.get(r.submission_id).push(r);
      } else {
        standalone.push(r);
      }
    }
    const grouped = Array.from(map.entries()).map(([sid, items]) => {
      const sorted = items.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      return { type: 'group', id: sid, items: sorted, created_date: sorted[0].created_date };
    });
    const singles = standalone.map(r => ({ type: 'single', id: r.id, items: [r], created_date: r.created_date }));
    return [...grouped, ...singles].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [filteredRequests]);

  const renderRequestDetail = (r, index, total) => (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
      {total > 1 && (
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
          <Link2 className="h-3.5 w-3.5" />
          Enlace #{index + 1} de {total}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-blue-700 bg-blue-50 rounded px-2 py-1">
          <Hash className="h-3 w-3" />{r.request_number || r.id.slice(0, 8).toUpperCase()}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Plataforma</p>
          <p className="mt-1 text-sm text-slate-800">{providerLabels[r.provider] || r.provider || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Monto</p>
          <p className="mt-1 text-sm text-slate-800">${(r.amount || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cantidad</p>
          <p className="mt-1 text-sm text-slate-800">{r.quantity || 1}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Modelo / Tipo</p>
          <p className="mt-1 text-sm text-slate-800">{r.model_type || '—'}</p>
        </div>
      </div>

      {r.product_image_url && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Foto del producto</p>
          <a href={r.product_image_url} target="_blank" rel="noreferrer" title="Ver foto del producto">
            <img src={r.product_image_url} alt="Producto" className="h-24 w-24 object-cover rounded border bg-white" />
          </a>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Enlace</p>
        {r.link_url ? (
          <a href={r.link_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline break-all inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3 shrink-0" /> {r.link_url}
          </a>
        ) : <p className="text-sm text-slate-400">—</p>}
      </div>

      {r.image_url && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">QR</p>
          <a href={r.image_url} target="_blank" rel="noreferrer" title="Ver QR">
            <img src={r.image_url} alt="QR" className="h-24 w-24 object-cover rounded border bg-white" />
          </a>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3 pt-1 border-t border-slate-100">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Comisión</p>
          <p className="mt-1 text-sm text-slate-800">${(r.fee_amount || 0).toFixed(2)} ({r.fee_percentage || 0}%)</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total ítem</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">${(r.total_amount || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Factura</p>
          <p className="mt-1 text-sm text-slate-800 break-all">{r.invoice_id || '—'}</p>
        </div>
      </div>

      {r.notes && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notas</p>
          <p className="text-sm text-slate-700 bg-amber-50 rounded p-2">{r.notes}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row pt-1">
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
  );

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
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por ID, cliente, plataforma, enlace o estado..."
              className="pl-9"
            />
          </div>
          {requests.length === 0 ? (
            <p className="text-sm text-slate-500">Sin solicitudes</p>
          ) : filteredRequests.length === 0 ? (
            <p className="text-sm text-slate-500">Sin resultados para tu búsqueda</p>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => {
                const first = g.items[0];
                const groupTotal = g.items.reduce((acc, r) => acc + (r.total_amount || 0), 0);
                const groupAmount = g.items.reduce((acc, r) => acc + (r.amount || 0), 0);
                const groupFee = g.items.reduce((acc, r) => acc + (r.fee_amount || 0), 0);
                const isMulti = g.items.length > 1;

                return (
                  <div key={g.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                    {/* Encabezado del grupo */}
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {isMulti && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-0.5">
                              <Link2 className="h-3 w-3" /> {g.items.length} enlaces
                            </span>
                          )}
                          <span className="text-sm font-semibold text-slate-800">{first.client_email}</span>
                          {(() => {
                            const client = clientsMap[(first.client_email || '').toLowerCase()];
                            const fullName = [client?.first_name, client?.last_name].filter(Boolean).join(' ');
                            const mark = client?.shipping_mark;
                            return (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {fullName && (
                                  <span className="rounded-full bg-slate-100 text-slate-700 text-xs font-medium px-2 py-0.5">{fullName}</span>
                                )}
                                {mark && (
                                  <span className="rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5">SM: {mark}</span>
                                )}
                              </div>
                            );
                          })()}
                          {(() => {
                            const href = getWhatsAppUrl(first.client_email, first.request_number);
                            if (!href) return null;
                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                title="Escribir por WhatsApp al cliente"
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 py-1"
                              >
                                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                              </a>
                            );
                          })()}
                        </div>
                        <p className="text-xs text-slate-500">{new Date(g.created_date).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Total del envío</p>
                        <p className="text-lg font-bold text-slate-900">${groupTotal.toFixed(2)}</p>
                        <p className="text-xs text-slate-500">Base ${groupAmount.toFixed(2)} + Comisión ${groupFee.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Detalle de cada enlace */}
                    <div className={isMulti ? "space-y-3" : ""}>
                      {g.items.map((r, idx) => renderRequestDetail(r, idx, g.items.length))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}