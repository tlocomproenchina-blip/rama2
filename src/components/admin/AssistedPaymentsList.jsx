import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { Link2, ExternalLink, Search, Hash, MessageCircle, Upload, PackageCheck, Loader2, Clipboard } from 'lucide-react';
import { buildWhatsAppUrl } from '@/lib/whatsappContact';
import useFileViewer from '@/hooks/useFileViewer';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';

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
  const [invoiceNumbers, setInvoiceNumbers] = React.useState({});
  const imageViewer = useFileViewer();
  const [uploadingReceipt, setUploadingReceipt] = React.useState({});
  const [savingTracking, setSavingTracking] = React.useState({});
  const [trackingInputs, setTrackingInputs] = React.useState({});

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

    // Obtener los números de factura reales (no el _id de Mongo)
    const invIds = Array.from(new Set((reqs || []).map(r => r.invoice_id).filter(Boolean)));
    if (invIds.length) {
      try {
        const invs = await base44.entities.Invoice.filter({ id: { $in: invIds } }, '-created_date', invIds.length);
        const numMap = {};
        (invs || []).forEach((inv) => { if (inv.id && inv.invoice_number) numMap[inv.id] = inv.invoice_number; });
        setInvoiceNumbers(numMap);
      } catch (_) {}
    }
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

  const handleUploadReceipt = async (req, file) => {
    setUploadingReceipt(prev => ({ ...prev, [req.id]: true }));
    try {
      const url = await uploadImageNoCredits(file);
      await base44.entities.AssistedPaymentRequest.update(req.id, { purchase_receipt_url: url });
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, purchase_receipt_url: url } : r));
      toast.success('Comprobante cargado');
    } catch (e) {
      toast.error(e.message || 'No se pudo subir el comprobante');
    }
    setUploadingReceipt(prev => ({ ...prev, [req.id]: false }));
  };

  const handlePasteReceipt = async (req) => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imgType = item.types.find((t) => t.startsWith('image/'));
        if (imgType) {
          const blob = await item.getType(imgType);
          await handleUploadReceipt(req, new File([blob], 'comprobante-pegado.png', { type: imgType }));
          return;
        }
      }
      toast.error('No hay ninguna imagen en el portapapeles');
    } catch (_) {
      toast.error('No se pudo leer el portapapeles. Usa Ctrl+V sobre esta sección.');
    }
  };

  const handlePasteReceiptEvent = (e, req) => {
    const file = Array.from(e.clipboardData?.items || [])
      .find((i) => i.type.startsWith('image/'))?.getAsFile();
    if (file) {
      e.preventDefault();
      handleUploadReceipt(req, file);
    }
  };

  const handleSaveTracking = async (req) => {
    const tracking = (trackingInputs[req.id] || '').trim();
    if (!tracking) return;
    setSavingTracking(prev => ({ ...prev, [req.id]: true }));
    try {
      const res = await base44.functions.invoke('createAssistedPaymentPrealert', { request_id: req.id, tracking_number: tracking });
      if (res?.data?.error) throw new Error(res.data.error);
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, tracking_number: tracking, tracking_prealerted: true } : r));
      setTrackingInputs(prev => { const n = { ...prev }; delete n[req.id]; return n; });
      toast.success('Pre-alerta creada automáticamente');
    } catch (e) {
      toast.error(e.message || 'No se pudo crear la pre-alerta');
    }
    setSavingTracking(prev => ({ ...prev, [req.id]: false }));
  };

  const updateStatus = async (req, status) => {
    try {
      if (status === 'en_proceso' && !req.invoice_id) {
        const res = await base44.functions.invoke('createAssistedPaymentInvoice', { request_id: req.id });
        const invId = res?.data?.invoice_id;
        const invNumber = res?.data?.invoice_number;
        await base44.entities.AssistedPaymentRequest.update(req.id, { status, invoice_id: invId });
        setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status, invoice_id: invId } : r));
        if (invId && invNumber) {
          setInvoiceNumbers(prev => ({ ...prev, [invId]: invNumber }));
        }
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
          <button type="button" onClick={() => imageViewer.open(r.product_image_url, 'Foto del producto')} title="Ver foto del producto" className="cursor-pointer">
            <img src={r.product_image_url} alt="Producto" className="h-24 w-24 object-cover rounded border bg-white" />
          </button>
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
          <button type="button" onClick={() => imageViewer.open(r.image_url, 'QR')} title="Ver QR" className="cursor-pointer">
            <img src={r.image_url} alt="QR" className="h-24 w-24 object-cover rounded border bg-white" />
          </button>
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
          <p className="mt-1 text-sm text-slate-800 break-all">{(r.invoice_id && invoiceNumbers[r.invoice_id]) || '—'}</p>
        </div>
      </div>

      {r.notes && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notas</p>
          <p className="text-sm text-slate-700 bg-amber-50 rounded p-2">{r.notes}</p>
        </div>
      )}

      {/* Comprobante de compra (admin) */}
      <div className="space-y-2 pt-2 border-t border-slate-100" onPaste={(e) => handlePasteReceiptEvent(e, r)} tabIndex={-1}>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Comprobante de compra</p>
        {r.purchase_receipt_url ? (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => imageViewer.open(r.purchase_receipt_url, 'Comprobante de compra')} className="cursor-pointer">
              <img src={r.purchase_receipt_url} alt="Comprobante" className="h-24 w-24 object-cover rounded border bg-white" />
            </button>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
                <Upload className="h-3.5 w-3.5" /> Reemplazar
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadReceipt(r, file);
                e.target.value = '';
              }} />
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <label className="cursor-pointer inline-flex">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 whitespace-nowrap">
                {uploadingReceipt[r.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadingReceipt[r.id] ? 'Subiendo...' : 'Cargar comprobante'}
              </span>
              <input type="file" accept="image/*" className="hidden" disabled={!!uploadingReceipt[r.id]} onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadReceipt(r, file);
                e.target.value = '';
              }} />
            </label>
            <button
              type="button"
              disabled={!!uploadingReceipt[r.id]}
              onClick={() => handlePasteReceipt(r)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              <Clipboard className="h-3.5 w-3.5" />
              Pegar imagen
            </button>
          </div>
        )}
      </div>

      {/* Tracking number (admin) → pre-alerta automática */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Número de tracking</p>
        {r.tracking_prealerted && r.tracking_number ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 rounded px-2 py-1 break-all">
              <PackageCheck className="h-3.5 w-3.5 shrink-0" /> {r.tracking_number}{r.model_type ? ` - ${r.model_type}` : ''}
            </span>
            <button
              type="button"
              onClick={() => {
                const text = r.model_type ? `${r.tracking_number} - ${r.model_type}` : r.tracking_number;
                navigator.clipboard?.writeText(text).then(() => toast.success('Copiado')).catch(() => {});
              }}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              title="Copiar tracking y descripción"
            >
              <Clipboard className="h-3.5 w-3.5" /> Copiar
            </button>
            <span className="text-xs text-emerald-600 whitespace-nowrap">Pre-alerta creada</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={trackingInputs[r.id] || ''}
              onChange={(e) => setTrackingInputs(prev => ({ ...prev, [r.id]: e.target.value }))}
              placeholder="Ingresa el tracking..."
              className="flex-1"
              disabled={!!savingTracking[r.id]}
            />
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
              disabled={!!savingTracking[r.id] || !(trackingInputs[r.id] || '').trim()}
              onClick={() => handleSaveTracking(r)}
            >
              {savingTracking[r.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
              Pre-alertar
            </Button>
          </div>
        )}
      </div>

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
      {imageViewer.modal}
    </div>
  );
}