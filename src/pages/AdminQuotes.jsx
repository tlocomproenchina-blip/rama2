import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, Copy, Check, Send, Plus, Trash2, FileText, Search, Package, Upload, Clipboard } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { sendNotification } from '@/components/NotificationUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import QuoteProductTable from '@/components/quotes/QuoteProductTable';
import QuoteSummary from '@/components/quotes/QuoteSummary';
import GlobalContractModal from '@/components/quotes/GlobalContractModal';
import { generateQuoteToken, calcQuoteTotals, calcItemTotals, buildWhatsAppMessage, buildWhatsAppLink } from '@/lib/quoteUtils';

const STATUS_LABELS = {
  esperando_cliente: { label: 'Esperando Cliente', color: 'bg-amber-100 text-amber-700' },
  cliente_completo: { label: 'Cliente Completó', color: 'bg-blue-100 text-blue-700' },
  completado: { label: 'Completado', color: 'bg-green-100 text-green-700' },
  enviado: { label: 'Enviado', color: 'bg-purple-100 text-purple-700' }
};

export default function AdminQuotes({ user }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await base44.entities.Quote.delete(deleteTarget.id);
      setQuotes(quotes.filter((q) => q.id !== deleteTarget.id));
      toast({ title: 'Presupuesto eliminado', description: deleteTarget.quote_number });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const loadQuotes = useCallback(async () => {
    try {
      const list = await base44.entities.Quote.list('-created_date', 100);
      setQuotes(list);
    } catch (err) {
      console.error('Error loading quotes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      if (configs.length) setConfig(configs[0]);
    } catch (err) {
      console.error('Error loading config:', err);
    }
  }, []);

  useEffect(() => { loadQuotes(); loadConfig(); }, [loadQuotes, loadConfig]);

  const createQuote = async () => {
    try {
      setSaving(true);
      const token = generateQuoteToken();
      // Calcular el siguiente número como el máximo existente + 1, para que
      // borrar un presupuesto no reutilice un número ya usado.
      const maxNum = quotes.reduce((max, q) => {
        const m = /PR-(\d+)/i.exec(q.quote_number || '');
        const n = m ? parseInt(m[1], 10) : 0;
        return n > max ? n : max;
      }, 0);
      const quoteNumber = `PR-${String(maxNum + 1).padStart(4, '0')}`;
      const globalRate = config?.quote_conversion_rate || 0.15;
      const created = await base44.entities.Quote.create({
        token,
        quote_number: quoteNumber,
        items: [],
        service_percentage: 15,
        conversion_rate: globalRate,
        status: 'esperando_cliente',
        created_by_email: user?.email
      });
      setQuotes([created, ...quotes]);
      setSelected(created);
      toast({ title: 'Presupuesto creado', description: 'Comparte el enlace con el cliente' });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (selected) {
    return (
      <QuoteEditor
        quote={selected}
        config={config}
        onBack={() => { setSelected(null); loadQuotes(); }}
        onUpdate={(updated) => setSelected(updated)}
        saving={saving}
        setSaving={setSaving}
        copied={copied}
        setCopied={setCopied}
        toast={toast}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Presupuestos</h1>
          <p className="text-sm text-gray-500">Crea cotizaciones y compártelas con clientes sin registro</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={createQuote} disabled={saving} style={{ backgroundColor: '#8b5cf6' }} className="text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Nuevo Presupuesto
          </Button>
          <Button variant="outline" onClick={() => setContractModalOpen(true)} className="gap-2">
            <FileText className="h-4 w-4" /> Contrato
          </Button>
        </div>
      </div>

      <GlobalContractModal
        open={contractModalOpen}
        onOpenChange={setContractModalOpen}
        config={config}
        onSaved={(updated) => setConfig(updated)}
      />

      <div className="space-y-3">
        {quotes.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400">
            No hay presupuestos creados. Crea el primero con "Nuevo Presupuesto".
          </div>
        )}
        {quotes.map((q) => {
          const st = STATUS_LABELS[q.status] || STATUS_LABELS.esperando_cliente;
          const clientName = `${q.client_first_name || ''} ${q.client_last_name || ''}`.trim() || 'Sin datos del cliente';
          return (
            <div
              key={q.id}
              className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:border-purple-300 hover:shadow-sm transition-all"
            >
              <button
                onClick={() => setSelected(q)}
                className="flex min-w-0 flex-1 items-center justify-between text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{q.quote_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>{st.label}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-gray-500">{clientName}</p>
                  {q.client_city && <p className="text-xs text-gray-400">{q.client_city}</p>}
                </div>
                <div className="ml-4 text-right">
                  <p className="text-sm font-bold" style={{ color: '#10b981' }}>${(q.total_usd || 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{(q.items || []).length} productos</p>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(q); }}
                className="ml-2 h-9 w-9 text-gray-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente el presupuesto <strong>{deleteTarget?.quote_number}</strong>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QuoteEditor({ quote, config, onBack, onUpdate, saving, setSaving, copied, setCopied, toast }) {
  const [items, setItems] = useState(quote.items || []);
  const [servicePercentage, setServicePercentage] = useState(quote.service_percentage || 15);
  const [conversionRate, setConversionRate] = useState(quote.conversion_rate || config?.quote_conversion_rate || 0.15);
  const [notes, setNotes] = useState(quote.notes || '');
  const [clientFirstName, setClientFirstName] = useState(quote.client_first_name || '');
  const [clientLastName, setClientLastName] = useState(quote.client_last_name || '');
  const [clientCity, setClientCity] = useState(quote.client_city || '');
  const [clientPhone, setClientPhone] = useState(quote.client_phone || '');
  const [clientEmail, setClientEmail] = useState(quote.client_email || '');
  const [shippingMark, setShippingMark] = useState(quote.shipping_mark || '');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);

  // Recalcular totales cuando cambian items, servicePercentage o conversionRate
  const totals = calcQuoteTotals(items, servicePercentage, conversionRate);

  const publicUrl = `${window.location.origin}/Quote/${quote.token}`;

  // Debounced email lookup para buscar shipping mark
  useEffect(() => {
    if (!clientEmail || !clientEmail.includes('@')) {
      setLookupResult(null);
      setShippingMark('');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setLookupLoading(true);
        const res = await base44.functions.invoke('lookupQuoteClient', { email: clientEmail });
        const data = res.data || res;
        setLookupResult(data);
        if (data.found && data.shipping_mark) {
          setShippingMark(data.shipping_mark);
        } else {
          setShippingMark('');
        }
      } catch (err) {
        console.error('Lookup error:', err);
      } finally {
        setLookupLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [clientEmail]);

  const handleItemsChange = (nextItems) => {
    // Recalcular totales por item
    const withTotals = nextItems.map(it => ({
      ...it,
      ...calcItemTotals(it, servicePercentage, conversionRate)
    }));
    setItems(withTotals);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Avanzar a 'completado' si hay items con precios definidos
      const hasPricedItems = withTotals.some(it => Number(it.unit_price) > 0);
      const nextStatus = hasPricedItems ? 'completado' : (quote.status === 'enviado' ? 'enviado' : quote.status);
      const updated = await base44.entities.Quote.update(quote.id, {
        items: withTotals,
        service_percentage: Number(servicePercentage),
        conversion_rate: Number(conversionRate),
        notes,
        client_first_name: clientFirstName,
        client_last_name: clientLastName,
        client_email: clientEmail,
        client_city: clientCity,
        client_phone: clientPhone,
        shipping_mark: shippingMark,
        subtotal_cny: totals.subtotal_cny,
        service_total_cny: totals.service_total_cny,
        total_cny: totals.total_cny,
        total_usd: totals.total_usd,
        status: nextStatus
      });
      onUpdate(updated);
      toast({ title: 'Presupuesto guardado', description: 'Los precios y totales se actualizaron' });

      // Notificar al cliente cuando el presupuesto pasa a "completado" (con precios)
      if (hasPricedItems && clientEmail && quote.status !== 'completado') {
        const publicUrl = `${window.location.origin}/Quote/${quote.token}`;
        const clientName = `${clientFirstName} ${clientLastName}`.trim() || 'cliente';
        sendNotification({
          to: clientEmail,
          subject: '📋 Tu presupuesto está listo',
          body: `<h2>📋 Tu presupuesto está listo</h2>
<p>Hola <strong>${clientName}</strong>,</p>
<p>Tu presupuesto ha sido procesado y ya está disponible para revisión.</p>
<p><strong>Total: $${(totals.total_usd || 0).toFixed(2)} USD</strong></p>
<p>Puedes verlo y aceptar el contrato en el siguiente enlace:</p>
<p><a href="${publicUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Ver Presupuesto</a></p>
<p style="margin-top:16px;color:#666;font-size:12px;">TLEC CARGO</p>`,
          title: '📋 Tu presupuesto está listo',
          message: `Tu presupuesto por $${(totals.total_usd || 0).toFixed(2)} USD está disponible. Revisa y acepta el contrato.`,
          type: 'system',
          icon: 'bell',
          referenceId: quote.id
        }).catch(() => {});
      }
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Recalcular items cuando cambia servicePercentage o conversionRate
  const withTotals = items.map(it => ({
    ...it,
    ...calcItemTotals(it, servicePercentage, conversionRate)
  }));

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Enlace copiado' });
  };

  const handleWhatsApp = async () => {
    // Guardar antes de enviar
    await handleSave();
    const quoteForMsg = {
      ...quote,
      client_first_name: clientFirstName,
      client_last_name: clientLastName,
      client_email: clientEmail,
      client_city: clientCity,
      client_phone: clientPhone,
      shipping_mark: shippingMark,
      items: withTotals,
      service_percentage: Number(servicePercentage),
      conversion_rate: Number(conversionRate),
      ...totals
    };
    const msg = buildWhatsAppMessage(quoteForMsg, publicUrl);
    const link = buildWhatsAppLink(clientPhone, msg);
    window.open(link, '_blank');

    // Marcar como enviado
    try {
      const updated = await base44.entities.Quote.update(quote.id, { status: 'enviado' });
      onUpdate(updated);
    } catch {}
  };

  const clientName = `${quote.client_first_name || ''} ${quote.client_last_name || ''}`.trim() || 'Pendiente';
  const hasClientData = quote.status !== 'esperando_cliente';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCopyLink} className="gap-2">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            Copiar Enlace
          </Button>
          <Button onClick={handleWhatsApp} disabled={saving} style={{ backgroundColor: '#25D366' }} className="text-white hover:opacity-90 gap-2">
            <Send className="h-4 w-4" /> Enviar WhatsApp
          </Button>
        </div>
      </div>

      {/* Datos del Cliente */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-bold" style={{ color: '#c52899' }}>Datos del Cliente</h3>
        {!hasClientData && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
            El cliente aún no ha completado sus datos. Puedes pre-cargarlos manualmente o compartir el enlace.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-gray-500">Nombre</Label>
            <Input value={clientFirstName} onChange={(e) => setClientFirstName(e.target.value)} placeholder="Nombre" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Apellido</Label>
            <Input value={clientLastName} onChange={(e) => setClientLastName(e.target.value)} placeholder="Apellido" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Ciudad de Despacho</Label>
            <Input value={clientCity} onChange={(e) => setClientCity(e.target.value)} placeholder="Ciudad" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Número de Contacto (WhatsApp)</Label>
            <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Ej: 4121234567" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Email</Label>
            <div className="relative mt-1">
              <Input
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="pr-10"
              />
              {lookupLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
            </div>
            {lookupResult && lookupResult.found && (
              <p className="mt-1 text-xs font-medium text-green-600">
                ✓ Cliente registrado: {lookupResult.full_name || ''}
              </p>
            )}
            {lookupResult && !lookupResult.found && clientEmail && clientEmail.includes('@') && (
              <p className="mt-1 text-xs text-gray-400">No registrado en la base de datos</p>
            )}
          </div>
          <div>
            <Label className="text-xs text-gray-500">Shipping Mark</Label>
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
          <Label className="text-xs text-gray-500">Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sin notas" className="mt-1" />
        </div>
      </div>

      {/* Productos */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <QuoteProductTable
          items={withTotals}
          servicePercentage={servicePercentage}
          conversionRate={conversionRate}
          onChange={handleItemsChange}
          readOnly={false}
          showPricing={true}
        />
      </div>

      {/* Configuración de precios */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 text-sm font-bold" style={{ color: '#c52899' }}>Configuración</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-gray-600">% de Servicio</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={servicePercentage}
              onChange={(e) => setServicePercentage(Number(e.target.value))}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Tasa de Conversión (1¥ = $)</Label>
            <Input
              type="number"
              step="0.001"
              min="0"
              value={conversionRate}
              onChange={(e) => setConversionRate(Number(e.target.value))}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-400">Global: ${(config?.quote_conversion_rate || 0.15).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <QuoteSummary
        subtotalCny={totals.subtotal_cny}
        serviceTotalCny={totals.service_total_cny}
        totalCny={totals.total_cny}
        totalUsd={totals.total_usd}
        servicePercentage={servicePercentage}
        conversionRate={conversionRate}
      />

      {quote.contract_accepted && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium text-green-600">
            ✓ Contrato aceptado el {quote.contract_accepted_date ? new Date(quote.contract_accepted_date).toLocaleString() : ''}
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: '#8b5cf6' }} className="text-white hover:opacity-90">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar Presupuesto
        </Button>
      </div>
    </div>
  );
}