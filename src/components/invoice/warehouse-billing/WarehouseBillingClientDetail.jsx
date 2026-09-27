import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, Truck, CheckCircle2, MessageCircle, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import WarehouseBillingItemRow from './WarehouseBillingItemRow';
import WarehouseBillingSummary from './WarehouseBillingSummary';
import {
  buildBillableItems, computeSelectionTotals, distributeAmounts, generateWarehouseInvoice, num,
} from '@/lib/warehouseBilling';
import { base44 } from '@/components/api/ApiQueueManager';
import { buildWhatsAppUrl } from '@/lib/whatsappContact';

export default function WarehouseBillingClientDetail({ client, ctx, appConfig, onBack, onGenerated }) {
  const { bultos: bultosBase, receipts } = useMemo(() => buildBillableItems(client, ctx), [client, ctx]);

  // CBM y cantidad de paquetes recién guardados: se aplican al instante sin esperar la recarga
  const [cargoEdits, setCargoEdits] = useState({});
  const bultos = useMemo(() => bultosBase.map((b) => {
    const edit = cargoEdits[b.id];
    if (!edit) return b;
    const merged = {
      ...b,
      cbm: edit.cbm != null ? edit.cbm : b.cbm,
      package_count: edit.package_count != null ? edit.package_count : b.package_count,
    };
    if (edit.tariff) {
      Object.assign(merged, {
        risk_category: edit.tariff.risk_category,
        registered_amount: edit.tariff.amount,
        registered_rate_per_cbm: edit.tariff.rate_per_cbm,
        registered_rate_kind: edit.tariff.kind,
        has_registered_tariff: true,
      });
    }
    return merged;
  }), [bultosBase, cargoEdits]);

  // Estado del cliente usado para tarifar (nombre legible si está configurado)
  const stateLabel = client.state ? (ctx?.stateConfig?.state_name || client.state) : '';

  // Al abrir un cliente nada llega marcado: el admin decide a mano qué se factura.
  const [selectedBultos, setSelectedBultos] = useState({});
  const [selectedReceipts, setSelectedReceipts] = useState({});
  const [overrides, setOverrides] = useState({
    billedCbm: '', insurance: '', consolidationMode: 'auto', consolidationFee: '',
    doorToDoor: '', extraAmount: '', extraConcept: '',
  });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);

  const setOverride = (key, value) => setOverrides((prev) => ({ ...prev, [key]: value }));

  const selectedItems = useMemo(() => [
    ...bultos.filter((b) => selectedBultos[b.id]),
    ...receipts.filter((r) => selectedReceipts[r.id]),
  ], [bultos, receipts, selectedBultos, selectedReceipts]);

  const totals = useMemo(
    () => computeSelectionTotals(selectedItems, ctx, overrides),
    [selectedItems, ctx, overrides]
  );
  const amounts = useMemo(() => distributeAmounts(selectedItems, totals), [selectedItems, totals]);

  const handleCreate = async () => {
    if (selectedItems.length === 0) return;
    setCreating(true);
    try {
      const invoice = await generateWarehouseInvoice({
        client, selectedItems, totals, appConfig,
      });
      setCreated(invoice);
      toast.success(`Factura ${invoice.invoice_number} generada por $${num(totals.total).toFixed(2)}`);
      onGenerated?.();
    } catch (e) {
      toast.error('Error al generar la factura');
    }
    setCreating(false);
  };

  // Registra/edita el CBM del bulto, corrige su cantidad de paquetes y deja
  // registrada su tarifa (estado del cliente + volumen + tipo de carga).
  const handleSaveCargo = async (item, values) => {
    const payload = { bulto_id: item.id };

    if (values.cbm != null) {
      if (values.cbm < 0) {
        toast.error('El CBM debe ser 0 o mayor');
        return false;
      }
      payload.cargo_cbm = values.cbm;
    }
    if (values.package_count != null) {
      if (values.package_count < 1) {
        toast.error('La cantidad de paquetes debe ser 1 o más');
        return false;
      }
      payload.cargo_package_count = Math.round(values.package_count);
    }
    if (payload.cargo_cbm === undefined && payload.cargo_package_count === undefined) {
      toast.error('Escribe el CBM o la cantidad de paquetes');
      return false;
    }

    const cbm = payload.cargo_cbm ?? num(item.cbm);
    const risk = values.risk_category || item.risk_category || 'general';
    const cbmChanged = payload.cargo_cbm !== undefined && cbm !== num(item.cbm);
    const riskChanged = risk !== (item.risk_category || 'general');
    // La tarifa se calcula al guardar el CBM, al cambiar el tipo de carga, al
    // recalcular a mano o cuando el bulto aún no tiene tarifa registrada.
    const shouldRegister = cbm > 0
      && (values.recalculate_tariff || cbmChanged || riskChanged || !item.has_registered_tariff);

    let tariff = null;
    if (shouldRegister) {
      const calc = ctx.calcTariff(cbm, item.fecha, risk);
      if (calc.amount <= 0) {
        toast.error('No se pudo calcular la tarifa: revisa el CBM y las tarifas vigentes');
        return false;
      }
      tariff = { ...calc, risk_category: risk };
      payload.cargo_amount = calc.amount;
      payload.cargo_rate_per_cbm = calc.rate_per_cbm;
      payload.cargo_rate_kind = calc.kind;
      payload.cargo_risk_category = risk;
    }

    try {
      const res = await base44.functions.invoke('updateBulto', payload);
      if (res?.data?.error) {
        toast.error(res.data.error);
        return false;
      }
      setCargoEdits((prev) => ({
        ...prev,
        [item.id]: { cbm: payload.cargo_cbm, package_count: payload.cargo_package_count, tariff },
      }));
      toast.success(
        tariff
          ? `CBM guardado y tarifa registrada: $${tariff.amount.toFixed(2)}`
          : 'CBM y paquetes guardados'
      );
      onGenerated?.();
      return true;
    } catch (e) {
      toast.error('No se pudo guardar. Intenta de nuevo.');
      return false;
    }
  };

  const handleWhatsApp = () => {
    const message = `Hola ${client.client_name}, le escribimos de TLEC CARGO. Su carga ya está en el almacén de Venezuela. Generamos la factura ${created?.invoice_number} por un monto de $${Number(created?.total || 0).toFixed(2)} para los envíos: ${selectedItems.map((i) => i.label).join(', ')}. Puede revisarla y pagar en su portal, en "Mis Facturas". ¡Gracias!`;
    const url = buildWhatsAppUrl(client.whatsapp, message);
    if (!url) {
      toast.error('Este cliente no tiene WhatsApp registrado');
      return;
    }
    window.open(url, '_blank');
  };

  if (created) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/60 shadow-card max-w-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
            <p className="text-lg font-semibold">Factura generada y enviada</p>
          </div>
          <div className="text-sm text-slate-700 space-y-1">
            <p>Cliente: <span className="font-medium">{client.client_name}</span></p>
            <p>Factura: <span className="font-mono">{created.invoice_number}</span></p>
            <p>Envíos: <span className="font-mono">{selectedItems.map((i) => i.label).join(', ')}</span></p>
            <p>Total: <span className="font-semibold">${Number(created.total || 0).toFixed(2)}</span></p>
          </div>
          <p className="text-xs text-emerald-700">
            El cliente ya recibió la notificación y el email para continuar con el pago de sus envíos disponibles para entrega.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleWhatsApp} className="bg-emerald-600 hover:bg-emerald-700">
              <MessageCircle className="h-4 w-4 mr-2" /> Avisar por WhatsApp
            </Button>
            <Button variant="outline" asChild>
              <a href="/AdminInvoices">
                <ExternalLink className="h-4 w-4 mr-2" /> Ver en Gestión de Facturas
              </a>
            </Button>
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver al listado
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-1 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver al listado
          </Button>
          <h2 className="text-xl font-semibold text-slate-800 truncate">{client.client_name}</h2>
          <p className="text-sm text-slate-500 break-all">{client.client_email}</p>
          <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-500">
            {client.shipping_mark && <span className="font-mono">{client.shipping_mark}</span>}
            {client.state && <span>· {client.state}</span>}
            {!client.registered && <Badge variant="secondary">Cliente sin cuenta registrada</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onGenerated}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <Card className="border-border/70 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Bultos en almacén (Venezuela)
                <span className="text-sm font-normal text-slate-400">({bultos.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {bultos.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">No hay bultos en almacén para este cliente.</p>
              ) : bultos.map((item) => (
                <WarehouseBillingItemRow
                  key={item.id}
                  item={item}
                  amount={amounts[item.id] || 0}
                  stateLabel={stateLabel}
                  rateLabel={ctx.getRateLabel(item.fecha)}
                  checked={!!selectedBultos[item.id]}
                  onToggle={() => setSelectedBultos((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  onSave={handleSaveCargo}
                />
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" /> Envíos / recibos CBM pendientes de facturar
                <span className="text-sm font-normal text-slate-400">({receipts.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {receipts.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">No hay recibos de CBM pendientes de facturar.</p>
              ) : receipts.map((item) => (
                <WarehouseBillingItemRow
                  key={item.id}
                  item={item}
                  amount={amounts[item.id] || 0}
                  checked={!!selectedReceipts[item.id]}
                  onToggle={() => setSelectedReceipts((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0">
          <WarehouseBillingSummary
            totals={totals}
            overrides={overrides}
            setOverride={setOverride}
            onCreate={handleCreate}
            creating={creating}
            canCreate={selectedItems.length > 0 && num(totals.total) > 0}
            clientName={client.client_name}
          />
          {creating && (
            <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Generando la factura…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}