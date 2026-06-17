import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ReceiptText, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import ClientSearchBox from '@/components/manual-billing/ClientSearchBox';
import ClientInfoCard from '@/components/manual-billing/ClientInfoCard';
import ClientStateRatesCard from '@/components/manual-billing/ClientStateRatesCard';
import BillingInvoiceRow from '@/components/manual-billing/BillingInvoiceRow';
import BillingSummary from '@/components/manual-billing/BillingSummary';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function AdminManualBilling() {
  const [appConfig, setAppConfig] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [stateConfigs, setStateConfigs] = useState([]);
  const [client, setClient] = useState(null);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [consolidationMode, setConsolidationMode] = useState('auto');
  const [manualConsolidationFee, setManualConsolidationFee] = useState('');
  const [billedCbm, setBilledCbm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [creating, setCreating] = useState(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    (async () => {
      const [cfgs, prc, states] = await Promise.all([
        base44.entities.AppConfig.filter({ config_key: 'main' }).catch(() => []),
        base44.entities.PricingConfig.filter({ config_key: 'main' }).catch(() => []),
        base44.entities.StateConfig.list('-updated_date', 100).catch(() => []),
      ]);
      setAppConfig(cfgs?.[0] || null);
      setPricing(prc?.[0] || null);
      setStateConfigs(states || []);
    })();
  }, []);

  const DOOR_TO_DOOR_THRESHOLD = 0.130;

  // Tarifa de envío del estado del cliente (StateConfig)
  const stateShippingRate = useMemo(() => {
    const code = String(client?.state || '').trim().toLowerCase();
    if (!code) return 0;
    const match = (stateConfigs || []).find((s) => String(s.state_code).toLowerCase() === code);
    return num(match?.shipping_rate);
  }, [client, stateConfigs]);

  // Precio final por CBM (>= 0.130) = (tarifa base * (1 + beneficio%)) + tarifa estado + puerta a puerta
  const finalRatePerCbm = useMemo(() => {
    const factor = 1 + num(pricing?.profit_percentage) / 100;
    return num(pricing?.base_rate_regular) * factor + stateShippingRate + num(pricing?.door_to_door_cost);
  }, [pricing, stateShippingRate]);

  // Usado como base por CBM para cargas >= 0.130 CBM
  const ratePerCbm = finalRatePerCbm;

  // Tarifas especiales (mínimos) para cargas < 0.130 CBM
  const specialRates = useMemo(() => {
    const list = Array.isArray(appConfig?.special_cbm_rates) ? appConfig.special_cbm_rates : [];
    return [...list].sort((x, y) => num(x.min_cbm) - num(y.min_cbm));
  }, [appConfig]);

  // Calcula el monto de envío aplicando tarifa de mínimos cuando corresponde
  const calcShipping = (cbm) => {
    const c = num(cbm);
    if (c <= 0) return 0;
    if (c >= DOOR_TO_DOOR_THRESHOLD) {
      return c * ratePerCbm;
    }
    const found = specialRates.find((r) => c <= num(r.max_cbm));
    return found ? num(found.rate_regular) : c * ratePerCbm;
  };

  // Recalcular envío de las filas cuando cambia la tarifa final por CBM del estado
  useEffect(() => {
    setRows((prev) => prev.map((r) => ({ ...r, shipping_amount: calcShipping(r.cbm).toFixed(2) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalRatePerCbm, specialRates]);

  const loadClientInvoices = async (selectedClient) => {
    setClient(selectedClient);
    setRows([]);
    setLoadingRows(true);
    try {
      const ingresos = await base44.entities.CbmIngreso.filter({ client_email: selectedClient.email }, '-fecha', 200);
      // Excluir registros que ya fueron facturados (solo se liberan al desconsolidar)
      const available = (ingresos || []).filter((ing) => !ing.billed);
      const built = available.map((ing) => {
        const cbm = num(ing.cbm);
        const totalFob = num(ing.fob_total);
        const trackings = ing.tracking_numbers || [];
        return {
          id: ing.id,
          invoice_number: ing.invoice_number || ing.descripcion || '—',
          consolidation_tracking: trackings.join(', '),
          consolidation_id: ing.id,
          tracking_numbers: trackings,
          fecha: ing.fecha,
          disponible_entrega: !!ing.disponible_entrega,
          total: num(ing.fob_total),
          package_count: trackings.length,
          insured_count: totalFob > 0 ? trackings.length : 0,
          total_fob: totalFob,
          selected: false,
          cbm_original: cbm,
          cbm: cbm ? cbm.toFixed(4) : '',
          shipping_amount: calcShipping(cbm).toFixed(2),
          insurance_amount: (totalFob * 0.05).toFixed(2),
        };
      });
      setRows(built);
    } catch {
      toast.error('Error al cargar registros del cliente');
    }
    setLoadingRows(false);
  };

  const updateRow = (updated) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== updated.id) return r;
      // Recalculate shipping when CBM changes
      if (updated.cbm !== r.cbm) {
        updated.shipping_amount = calcShipping(updated.cbm).toFixed(2);
      }
      return updated;
    }));
  };

  const selectedRows = rows.filter((r) => r.selected);
  // Si hay un CBM facturado manual, el envío se recalcula con ese CBM total; si no, suma por fila
  const shippingTotal = billedCbm !== ''
    ? calcShipping(num(billedCbm))
    : selectedRows.reduce((s, r) => s + num(r.shipping_amount), 0);
  const insuranceTotal = selectedRows.reduce((s, r) => s + num(r.insurance_amount), 0);
  const totalPackages = selectedRows.reduce((s, r) => s + (r.package_count || 0), 0);
  const consolidationFee = consolidationMode === 'manual' ? num(manualConsolidationFee) : totalPackages * 1;
  const total = shippingTotal + insuranceTotal + consolidationFee;

  const handleCreate = async () => {
    if (selectedRows.length === 0) { toast.error('Selecciona al menos una factura'); return; }
    setCreating(true);
    try {
      const totalCbm = selectedRows.reduce((s, r) => s + num(r.cbm), 0);
      const billedCbmValue = billedCbm !== '' ? num(billedCbm) : totalCbm;
      const useManualCbm = billedCbm !== '';

      const items = [];
      if (useManualCbm) {
        const manualShipping = calcShipping(billedCbmValue);
        items.push({
          description: `Envío - ${billedCbmValue.toFixed(4)} CBM facturado`,
          quantity: 1,
          unit_price: manualShipping,
          total: manualShipping,
          details: { cbm: billedCbmValue, billed_cbm: billedCbmValue, total_cbm: totalCbm },
        });
        selectedRows.forEach((r) => {
          if (num(r.insurance_amount) > 0) {
            items.push({
              description: `Seguro de carga - ${r.consolidation_tracking || r.invoice_number}`,
              quantity: 1,
              unit_price: num(r.insurance_amount),
              total: num(r.insurance_amount),
              details: { fob_value: r.total_fob, insured_packages: r.insured_count },
            });
          }
        });
      } else {
      selectedRows.forEach((r) => {
        items.push({
          description: `Envío - ${r.consolidation_tracking || r.invoice_number} (${r.cbm || 0} CBM)`,
          quantity: 1,
          unit_price: num(r.shipping_amount),
          total: num(r.shipping_amount),
          details: { cbm: num(r.cbm), source_invoice: r.invoice_number },
        });
        if (num(r.insurance_amount) > 0) {
          items.push({
            description: `Seguro de carga - ${r.consolidation_tracking || r.invoice_number}`,
            quantity: 1,
            unit_price: num(r.insurance_amount),
            total: num(r.insurance_amount),
            details: { fob_value: r.total_fob, insured_packages: r.insured_count },
          });
        }
      });
      }
      if (consolidationFee > 0) {
        items.push({
          description: consolidationMode === 'manual'
            ? 'Servicio de consolidación (manual)'
            : `Servicio de consolidación ($1 × ${totalPackages} paquetes)`,
          quantity: consolidationMode === 'manual' ? 1 : totalPackages,
          unit_price: consolidationMode === 'manual' ? consolidationFee : 1,
          total: consolidationFee,
          details: { package_count: totalPackages },
        });
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + num(appConfig?.invoice_overdue_days || 7));

      const invoice = await base44.entities.Invoice.create({
        invoice_number: `INV-M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        client_email: client.email,
        consolidation_id: selectedRows[0].consolidation_id || 'manual',
        consolidation_tracking: selectedRows.map((r) => r.consolidation_tracking).filter(Boolean).join(', '),
        invoice_date: new Date().toISOString(),
        due_date: dueDate.toISOString(),
        items,
        subtotal: total,
        tax: 0,
        total,
        status: 'pendiente',
        payment_method: paymentMethod || undefined,
        billed_cbm: billedCbmValue,
        total_cbm: totalCbm,
        notes: `Factura manual combinada generada desde ${selectedRows.length} factura(s): ${selectedRows.map((r) => r.invoice_number).join(', ')}. CBM total: ${totalCbm.toFixed(5)} | CBM facturado: ${billedCbmValue.toFixed(5)}`,
      });

      // Marcar los registros de CBM usados como facturados (se liberan al desconsolidar)
      await Promise.all(selectedRows.map((r) =>
        base44.entities.CbmIngreso.update(r.id, { billed: true, billed_invoice_id: invoice.id })
      ));

      toast.success(`Factura ${invoice.invoice_number} generada`);

      // Generar cuenta por pagar al proveedor y calcular ganancia
      try {
        const res = await base44.functions.invoke('processInvoiceForAccounting', { invoiceId: invoice.id });
        const profit = res?.data?.profit_amount;
        const cost = res?.data?.provider_cost_total;
        if (profit !== undefined) {
          toast.success(`Cuenta por pagar creada (costo proveedor $${num(cost).toFixed(2)}). Ganancia: $${num(profit).toFixed(2)}`, { duration: 8000 });
        }
      } catch {
        toast.warning('Factura creada, pero no se pudo generar la cuenta por pagar automáticamente');
      }
      // Quitar de la lista los registros ya facturados
      const billedIds = new Set(selectedRows.map((r) => r.id));
      setRows((prev) => prev.filter((r) => !billedIds.has(r.id)));
      setPaymentMethod('');
      setManualConsolidationFee('');
      setBilledCbm('');
    } catch {
      toast.error('Error al generar la factura');
    }
    setCreating(false);
  };

  // Recupera registros marcados como facturados cuya factura ya no existe (huérfanos)
  const handleRecoverOrphans = async () => {
    setRecovering(true);
    try {
      const billed = await base44.entities.CbmIngreso.filter({ billed: true }, '-fecha', 500).catch(() => []);
      if (!billed || billed.length === 0) {
        toast.info('No hay registros facturados para revisar');
        setRecovering(false);
        return;
      }
      // Obtener IDs de facturas existentes
      const invoiceIds = [...new Set(billed.map((b) => b.billed_invoice_id).filter(Boolean))];
      const existingInvoices = await Promise.all(
        invoiceIds.map((id) => base44.entities.Invoice.filter({ id }).then((r) => r?.[0]).catch(() => null))
      );
      const existingIds = new Set(existingInvoices.filter(Boolean).map((inv) => inv.id));

      // Huérfanos: facturados sin factura existente (o sin billed_invoice_id)
      const orphans = billed.filter((b) => !b.billed_invoice_id || !existingIds.has(b.billed_invoice_id));
      if (orphans.length === 0) {
        toast.success('Todo en orden: no hay registros huérfanos');
        setRecovering(false);
        return;
      }
      await Promise.all(orphans.map((o) => base44.entities.CbmIngreso.update(o.id, { billed: false, billed_invoice_id: null })));
      toast.success(`${orphans.length} registro(s) recuperado(s) y disponibles de nuevo`);
      if (client) loadClientInvoices(client);
    } catch {
      toast.error('Error al recuperar registros');
    }
    setRecovering(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ReceiptText className="h-6 w-6 text-blue-600" /> Facturación Manual
          </h1>
          <p className="text-slate-500">Busca un cliente, selecciona facturas registradas y genera una factura combinada</p>
        </div>
        <Button variant="outline" onClick={handleRecoverOrphans} disabled={recovering}>
          {recovering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
          Recuperar registros huérfanos
        </Button>
      </div>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-5">
          <ClientSearchBox onSelect={loadClientInvoices} />
        </CardContent>
      </Card>

      {client && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4 min-w-0">
            <ClientInfoCard client={client} onClear={() => { setClient(null); setRows([]); }} />
            <ClientStateRatesCard client={client} stateConfigs={stateConfigs} appConfig={appConfig} pricing={pricing} />

            {loadingRows ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : rows.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
                  Este cliente no tiene registros de CBM.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
                  <BillingInvoiceRow key={row.id} row={row} onChange={updateRow} />
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-1 min-w-0">
            <BillingSummary
              rows={rows}
              consolidationMode={consolidationMode}
              setConsolidationMode={setConsolidationMode}
              manualConsolidationFee={manualConsolidationFee}
              setManualConsolidationFee={setManualConsolidationFee}
              consolidationFee={consolidationFee}
              shippingTotal={shippingTotal}
              insuranceTotal={insuranceTotal}
              total={total}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              appConfig={appConfig}
              onCreate={handleCreate}
              creating={creating}
              canCreate={selectedRows.length > 0}
              billedCbm={billedCbm}
              setBilledCbm={setBilledCbm}
            />
          </div>
        </div>
      )}
    </div>
  );
}