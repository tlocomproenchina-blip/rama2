import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import ClientSearchBox from '@/components/manual-billing/ClientSearchBox';
import ClientInfoCard from '@/components/manual-billing/ClientInfoCard';
import BillingInvoiceRow from '@/components/manual-billing/BillingInvoiceRow';
import BillingSummary from '@/components/manual-billing/BillingSummary';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function AdminManualBilling() {
  const [appConfig, setAppConfig] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [client, setClient] = useState(null);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [consolidationMode, setConsolidationMode] = useState('auto');
  const [manualConsolidationFee, setManualConsolidationFee] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const [cfgs, prc] = await Promise.all([
        base44.entities.AppConfig.filter({ config_key: 'main' }).catch(() => []),
        base44.entities.PricingConfig.filter({ config_key: 'main' }).catch(() => []),
      ]);
      setAppConfig(cfgs?.[0] || null);
      setPricing(prc?.[0] || null);
    })();
  }, []);

  // Rate per CBM from config (maritime general rate)
  const ratePerCbm = useMemo(() => {
    return num(appConfig?.rate_sea_general) || num(pricing?.base_rate_regular) || 0;
  }, [appConfig, pricing]);

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
          total: num(ing.fob_total),
          package_count: trackings.length,
          insured_count: totalFob > 0 ? trackings.length : 0,
          total_fob: totalFob,
          selected: false,
          cbm_original: cbm,
          cbm: cbm ? cbm.toFixed(4) : '',
          shipping_amount: (cbm * ratePerCbm).toFixed(2),
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
        updated.shipping_amount = (num(updated.cbm) * ratePerCbm).toFixed(2);
      }
      return updated;
    }));
  };

  const selectedRows = rows.filter((r) => r.selected);
  const shippingTotal = selectedRows.reduce((s, r) => s + num(r.shipping_amount), 0);
  const insuranceTotal = selectedRows.reduce((s, r) => s + num(r.insurance_amount), 0);
  const totalPackages = selectedRows.reduce((s, r) => s + (r.package_count || 0), 0);
  const consolidationFee = consolidationMode === 'manual' ? num(manualConsolidationFee) : totalPackages * 1;
  const total = shippingTotal + insuranceTotal + consolidationFee;

  const handleCreate = async () => {
    if (selectedRows.length === 0) { toast.error('Selecciona al menos una factura'); return; }
    setCreating(true);
    try {
      const items = [];
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
        notes: `Factura manual combinada generada desde ${selectedRows.length} factura(s): ${selectedRows.map((r) => r.invoice_number).join(', ')}`,
      });

      // Marcar los registros de CBM usados como facturados (se liberan al desconsolidar)
      await Promise.all(selectedRows.map((r) =>
        base44.entities.CbmIngreso.update(r.id, { billed: true, billed_invoice_id: invoice.id })
      ));

      toast.success(`Factura ${invoice.invoice_number} generada`);
      // Quitar de la lista los registros ya facturados
      const billedIds = new Set(selectedRows.map((r) => r.id));
      setRows((prev) => prev.filter((r) => !billedIds.has(r.id)));
      setPaymentMethod('');
      setManualConsolidationFee('');
    } catch {
      toast.error('Error al generar la factura');
    }
    setCreating(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ReceiptText className="h-6 w-6 text-blue-600" /> Facturación Manual
        </h1>
        <p className="text-slate-500">Busca un cliente, selecciona facturas registradas y genera una factura combinada</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-5">
          <ClientSearchBox onSelect={loadClientInvoices} />
        </CardContent>
      </Card>

      {client && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <ClientInfoCard client={client} onClear={() => { setClient(null); setRows([]); }} />

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

          <div className="lg:col-span-1">
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
            />
          </div>
        </div>
      )}
    </div>
  );
}