import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import PackagesWithoutReceiptSection from '@/components/manual-billing/PackagesWithoutReceiptSection';

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
  const [manualInsurance, setManualInsurance] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [providerInvoiceUrl, setProviderInvoiceUrl] = useState('');
  const [manualReceiptNumber, setManualReceiptNumber] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [extraConcept, setExtraConcept] = useState('');
  const [doorToDoorFee, setDoorToDoorFee] = useState('');
  const [creating, setCreating] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [rateHistory, setRateHistory] = useState([]);
  const [orphanPackages, setOrphanPackages] = useState([]);

  useEffect(() => {
    (async () => {
      const [cfgs, prc, states, history] = await Promise.all([
        base44.entities.AppConfig.filter({ config_key: 'main' }).catch(() => []),
        base44.entities.PricingConfig.filter({ config_key: 'main' }).catch(() => []),
        base44.entities.StateConfig.list('-updated_date', 100).catch(() => []),
        base44.entities.RateHistory.list('-effective_date', 200).catch(() => []),
      ]);
      setAppConfig(cfgs?.[0] || null);
      setPricing(prc?.[0] || null);
      setStateConfigs(states || []);
      setRateHistory(history || []);
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

  // Tarifas especiales (mínimos) para cargas < 0.130 CBM (vigentes actualmente)
  const specialRates = useMemo(() => {
    const list = Array.isArray(appConfig?.special_cbm_rates) ? appConfig.special_cbm_rates : [];
    return [...list].sort((x, y) => num(x.min_cbm) - num(y.min_cbm));
  }, [appConfig]);

  // Snapshot de tarifas actuales (live config) — usado como fallback y para recibos sin fecha
  const currentRateSet = useMemo(() => ({
    base_rate_regular: num(pricing?.base_rate_regular),
    base_rate_high_risk: num(pricing?.base_rate_high_risk),
    profit_percentage: num(pricing?.profit_percentage),
    door_to_door_cost: num(pricing?.door_to_door_cost),
    special_cbm_rates: specialRates,
    effective_date: null
  }), [pricing, specialRates]);

  // Resuelve el set de tarifas vigente para una fecha dada, usando RateHistory
  const getRateSetForDate = useCallback((fecha) => {
    if (!fecha || !rateHistory.length) return currentRateSet;
    const d = new Date(String(fecha).includes('T') ? fecha : `${fecha}T12:00:00`);
    if (isNaN(d)) return currentRateSet;
    const sorted = [...rateHistory].sort((a, b) => new Date(a.effective_date) - new Date(b.effective_date));
    let chosen = null;
    for (const r of sorted) {
      const ed = new Date(String(r.effective_date).includes('T') ? r.effective_date : `${r.effective_date}T00:00:00`);
      if (ed <= d) chosen = r;
      else break;
    }
    if (!chosen) return currentRateSet;
    return {
      base_rate_regular: num(chosen.base_rate_regular),
      base_rate_high_risk: num(chosen.base_rate_high_risk),
      profit_percentage: num(chosen.profit_percentage),
      door_to_door_cost: num(chosen.door_to_door_cost),
      special_cbm_rates: Array.isArray(chosen.special_cbm_rates) ? chosen.special_cbm_rates : [],
      effective_date: chosen.effective_date
    };
  }, [rateHistory, currentRateSet]);

  // Tarifa por CBM (>= 0.130) para un set de tarifas dado
  const computeRatePerCbm = useCallback((rateSet) => {
    const factor = 1 + num(rateSet.profit_percentage) / 100;
    return num(rateSet.base_rate_regular) * factor + stateShippingRate + num(rateSet.door_to_door_cost);
  }, [stateShippingRate]);

  // Calcula el monto de envío de un recibo individual según su fecha de llegada
  const calcShippingForRow = useCallback((cbm, fecha) => {
    const c = num(cbm);
    if (c <= 0) return 0;
    const rateSet = getRateSetForDate(fecha);
    if (c >= DOOR_TO_DOOR_THRESHOLD) {
      return c * computeRatePerCbm(rateSet);
    }
    const specials = Array.isArray(rateSet.special_cbm_rates) ? rateSet.special_cbm_rates : [];
    const sorted = [...specials].sort((x, y) => num(x.min_cbm) - num(y.min_cbm));
    const found = sorted.find((r) => c <= num(r.max_cbm));
    return found ? num(found.rate_regular) : c * computeRatePerCbm(rateSet);
  }, [getRateSetForDate, computeRatePerCbm]);

  // Determina si un recibo usa tarifa anterior o actual (para el badge)
  const getRateLabel = useCallback((fecha) => {
    if (!fecha || !rateHistory.length) return 'actual';
    const latest = [...rateHistory].sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date))[0];
    const resolved = getRateSetForDate(fecha);
    if (resolved.effective_date && latest && new Date(resolved.effective_date) < new Date(latest.effective_date)) {
      return 'anterior';
    }
    return 'actual';
  }, [rateHistory, getRateSetForDate]);

  // Cálculo consolidado de envío para la factura:
  // - CBM total >= 0.130 (lineal): divide el CBM por período de tarifa y suma
  // - CBM total < 0.130 (tarifa especial fija): usa la tarifa del recibo más reciente
  const calcConsolidatedShipping = useCallback((billedCbm, selected) => {
    const c = num(billedCbm);
    if (c <= 0) return 0;
    if (c >= DOOR_TO_DOOR_THRESHOLD) {
      const totalReceiptCbm = selected.reduce((s, r) => s + num(r.cbm), 0);
      if (totalReceiptCbm <= 0) {
        return c * computeRatePerCbm(currentRateSet);
      }
      // Agrupar CBM por set de tarifa (resuelto por fecha del recibo)
      const groups = {};
      selected.forEach((r) => {
        if (num(r.cbm) <= 0) return;
        const rs = getRateSetForDate(r.fecha);
        const key = rs.effective_date || 'current';
        if (!groups[key]) groups[key] = { rateSet: rs, cbm: 0 };
        groups[key].cbm += num(r.cbm);
      });
      // Escalar al CBM facturado si difiere del total de recibos
      const scale = totalReceiptCbm > 0 ? c / totalReceiptCbm : 1;
      return Object.values(groups).reduce((sum, g) => sum + g.cbm * scale * computeRatePerCbm(g.rateSet), 0);
    }
    // Tarifa especial fija: usar la tarifa del recibo más reciente con fecha
    const withDates = selected.filter((r) => r.fecha);
    const rateSet = withDates.length > 0
      ? getRateSetForDate(withDates.reduce((max, r) => new Date(r.fecha) > new Date(max.fecha) ? r : max).fecha)
      : currentRateSet;
    const specials = Array.isArray(rateSet.special_cbm_rates) ? rateSet.special_cbm_rates : [];
    const sorted = [...specials].sort((x, y) => num(x.min_cbm) - num(y.min_cbm));
    const found = sorted.find((r) => c <= num(r.max_cbm));
    return found ? num(found.rate_regular) : 0;
  }, [getRateSetForDate, computeRatePerCbm, currentRateSet]);

  // Recalcular envío de las filas cuando cambian las tarifas o el historial
  useEffect(() => {
    setRows((prev) => prev.map((r) => ({ ...r, shipping_amount: calcShippingForRow(r.cbm, r.fecha).toFixed(2), rate_label: getRateLabel(r.fecha) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalRatePerCbm, specialRates, rateHistory, stateShippingRate]);

  const loadClientInvoices = async (selectedClient) => {
    setClient(selectedClient);
    setRows([]);
    setCreditBalance(0);
    setOrphanPackages([]);
    setLoadingRows(true);
    try {
      const [ingresos, pkgs, credits, dispatchOrders] = await Promise.all([
        base44.entities.CbmIngreso.filter({ client_email: selectedClient.email }, '-fecha', 200),
        base44.entities.Package.filter({ client_email: selectedClient.email }, '-created_date', 500).catch(() => []),
        base44.entities.ClientCredit.filter({ client_email: selectedClient.email }).catch(() => []),
        base44.entities.DispatchOrder.filter({ client_email: selectedClient.email }, '-dispatched_date', 500).catch(() => []),
      ]);
      const balance = (credits || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
      setCreditBalance(Math.max(0, balance));

      // Normaliza un tracking: quita prefijo de transportista (texto antes de ":" o "：") y mayúsculas
      const normTracking = (raw) => String(raw || '').split(/[:：]/).pop().trim().toUpperCase();

      // Set de trackings que tienen orden de despacho registrada (DispatchOrder)
      const dispatchedTrackings = new Set();
      (dispatchOrders || []).forEach((ord) => {
        (ord.items || []).forEach((it) => {
          const t = normTracking(it.tracking_number);
          if (t) dispatchedTrackings.add(t);
        });
      });

      // Mapa de FOB asegurado por número de tracking normalizado (desde los paquetes con seguro)
      const insuredFobByTracking = {};
      (pkgs || []).forEach((p) => {
        const fob = num(p.fob_value);
        if (fob <= 0) return;
        String(p.tracking_number || '')
          .split(/[，,;|]+/)
          .map(normTracking)
          .filter(Boolean)
          .forEach((t) => { insuredFobByTracking[t] = Math.max(insuredFobByTracking[t] || 0, fob); });
      });

      // Excluir registros que ya fueron facturados (solo se liberan al desconsolidar)
      const available = (ingresos || []).filter((ing) => !ing.billed);

      // Construir set de trackings que ya tienen recibo (CbmIngreso)
      const trackingsWithReceipt = new Set();
      (ingresos || []).forEach((ing) => {
        (ing.tracking_numbers || []).forEach((t) => trackingsWithReceipt.add(normTracking(t)));
      });

      // Paquetes sin recibo: su tracking no aparece en ningún CbmIngreso
      // Y además deben tener una orden de despacho registrada (DispatchOrder)
      const orphans = (pkgs || [])
        .filter((p) => {
          const t = normTracking(p.tracking_number);
          return t && !trackingsWithReceipt.has(t) && dispatchedTrackings.has(t);
        })
        .map((p) => ({
          id: p.id,
          tracking_number: p.tracking_number,
          fob_value: num(p.fob_value),
          selected: false,
          assigned_receipt_id: '',
        }));
      setOrphanPackages(orphans);

      const built = available.map((ing) => {
        const cbm = num(ing.cbm);
        const trackings = ing.tracking_numbers || [];
        // FOB asegurado: usar fob_total del registro o, si falta, sumar el FOB de los paquetes asegurados que coincidan por tracking
        const trackingFob = trackings.reduce((s, t) => s + (insuredFobByTracking[normTracking(t)] || 0), 0);
        const insuredCount = trackings.filter((t) => (insuredFobByTracking[normTracking(t)] || 0) > 0).length;
        const totalFob = num(ing.fob_total) > 0 ? num(ing.fob_total) : trackingFob;
        return {
          id: ing.id,
          invoice_number: ing.invoice_number || ing.descripcion || '—',
          consolidation_tracking: trackings.join(', '),
          consolidation_id: ing.id,
          tracking_numbers: trackings,
          fecha: ing.fecha,
          fecha_salida: ing.fecha_salida || null,
          fecha_estimada_llegada: ing.fecha_estimada_llegada || null,
          disponible_entrega: !!ing.disponible_entrega,
          total: num(ing.fob_total),
          package_count: trackings.length,
          insured_count: insuredCount > 0 ? insuredCount : (totalFob > 0 ? trackings.length : 0),
          total_fob: totalFob,
          selected: false,
          cbm_original: cbm,
          cbm: cbm ? cbm.toFixed(4) : '',
          shipping_amount: calcShippingForRow(cbm, ing.fecha).toFixed(2),
          rate_label: getRateLabel(ing.fecha),
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
        updated.shipping_amount = calcShippingForRow(updated.cbm, updated.fecha).toFixed(2);
      }
      return updated;
    }));
  };

  const selectedRows = rows.filter((r) => r.selected);
  const selectedOrphans = orphanPackages.filter((p) => p.selected);
  // El envío SIEMPRE se cobra consolidado: un solo cálculo sobre el CBM total
  // (manual si se indicó "CBM facturado", o la suma de las cargas seleccionadas)
  const selectedCbmSum = selectedRows.reduce((s, r) => s + num(r.cbm), 0);
  const totalCbmAll = selectedCbmSum;
  const shippingTotal = calcConsolidatedShipping(billedCbm !== '' ? num(billedCbm) : totalCbmAll, selectedRows);
  const autoInsuranceTotal = selectedRows.reduce((s, r) => s + num(r.insurance_amount), 0);
  // Seguro de paquetes sin recibo: 5% del FOB si tienen valor asegurado (línea separada)
  const orphanInsuranceTotal = selectedOrphans.reduce((s, p) => s + (num(p.fob_value) * 0.05), 0);
  const insuranceTotal = manualInsurance !== '' ? num(manualInsurance) : (autoInsuranceTotal + orphanInsuranceTotal);
  const totalPackages = selectedRows.reduce((s, r) => s + (r.package_count || 0), 0) + selectedOrphans.length;
  const consolidationFee = consolidationMode === 'manual' ? num(manualConsolidationFee) : totalPackages * 1;
  const extraAmountValue = num(extraAmount);
  const doorToDoorValue = num(doorToDoorFee);
  const total = shippingTotal + insuranceTotal + consolidationFee + extraAmountValue + doorToDoorValue;

  const handleCreate = async () => {
    const manualReceipt = String(manualReceiptNumber || '').trim();
    const selOrphans = orphanPackages.filter((p) => p.selected);
    if (selectedRows.length === 0 && !manualReceipt && selOrphans.length === 0) { toast.error('Selecciona al menos una factura, un paquete sin recibo o ingresa un número de recibo nuevo'); return; }
    // Validar que cada paquete sin recibo seleccionado tenga un recibo asignado
    if (selOrphans.length > 0 && selectedRows.length === 0 && !manualReceipt) {
      toast.error('Primero selecciona al menos un recibo en la lista principal para asignar los paquetes sin recibo');
      return;
    }
    const orphansWithoutReceipt = selOrphans.filter((p) => !p.assigned_receipt_id);
    if (orphansWithoutReceipt.length > 0) { toast.error(`Falta asignar un recibo a ${orphansWithoutReceipt.length} paquete(s) sin recibo`); return; }
    setCreating(true);
    try {
      // Validar que el número de recibo nuevo no exista ya
      if (manualReceipt) {
        const existing = await base44.entities.CbmIngreso.filter({ invoice_number: manualReceipt }, '-fecha', 1).catch(() => []);
        if (existing && existing.length > 0) {
          toast.error(`El número de recibo ${manualReceipt} ya existe. Usa uno diferente.`);
          setCreating(false);
          return;
        }
      }

      const totalCbm = selectedRows.reduce((s, r) => s + num(r.cbm), 0);
      const selOrphans = orphanPackages.filter((p) => p.selected);
      const totalCbmWithOrphans = totalCbm;
      const billedCbmValue = billedCbm !== '' ? num(billedCbm) : totalCbmWithOrphans;

      // Los paquetes sin recibo se asignan a recibos existentes — no se crea recibo nuevo
      const orphanReceiptNumber = null;

      const useManualInsurance = manualInsurance !== '';
      const items = [];
      // Envío SIEMPRE consolidado: un solo item con el CBM total de todas las cargas
      const consolidatedShipping = calcConsolidatedShipping(billedCbmValue, selectedRows);
      const sourceOrders = [
        ...selectedRows.map((r) => r.invoice_number).filter((n) => n && n !== '—'),
        ...(manualReceipt ? [manualReceipt] : []),
        ...(orphanReceiptNumber ? [orphanReceiptNumber] : []),
      ];
      // Detalle por recibo: número + CBM individual
      const manualReceiptCbm = Math.max(billedCbmValue - totalCbmWithOrphans, 0);
      const ratePerCbm = billedCbmValue > 0 ? consolidatedShipping / billedCbmValue : 0;
      // Cada recibo (envío) se muestra como su propia línea con su CBM y precio individual
      selectedRows
        .filter((r) => r.invoice_number && r.invoice_number !== '—')
        .forEach((r) => {
          const cbm = num(r.cbm);
          items.push({
            description: `Envío ${r.invoice_number}`,
            quantity: cbm,
            unit_price: ratePerCbm,
            total: cbm * ratePerCbm,
            details: { cbm, invoice_number: r.invoice_number, source_invoices: [r.invoice_number] },
          });
        });
      if (manualReceipt) {
        items.push({
          description: `Envío ${manualReceipt}`,
          quantity: manualReceiptCbm,
          unit_price: ratePerCbm,
          total: manualReceiptCbm * ratePerCbm,
          details: { cbm: manualReceiptCbm, invoice_number: manualReceipt, source_invoices: [manualReceipt] },
        });
      }
      if (!useManualInsurance) {
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
        // Seguro de paquetes sin recibo (5% FOB)
        selOrphans.forEach((p) => {
          const ins = num(p.fob_value) * 0.05;
          if (ins > 0) {
            items.push({
              description: `Seguro de carga - ${p.tracking_number}`,
              quantity: 1,
              unit_price: ins,
              total: ins,
              details: { fob_value: p.fob_value, insured_packages: 1, orphan_package: true },
            });
          }
        });
      }
      if (useManualInsurance && insuranceTotal > 0) {
        items.push({
          description: 'Seguro de carga',
          quantity: 1,
          unit_price: insuranceTotal,
          total: insuranceTotal,
          details: { manual: true },
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
      if (doorToDoorValue > 0) {
        items.push({
          description: 'Envío puerta a puerta',
          quantity: 1,
          unit_price: doorToDoorValue,
          total: doorToDoorValue,
          details: { door_to_door: true },
        });
      }
      if (extraAmountValue > 0) {
        items.push({
          description: String(extraConcept || '').trim() || 'Monto adicional',
          quantity: 1,
          unit_price: extraAmountValue,
          total: extraAmountValue,
          details: { extra_charge: true },
        });
      }

      // Agrupar huérfanos por recibo asignado para incluirlos en su recibo
      const orphansByReceipt = {};
      selOrphans.forEach((p) => {
        const rid = p.assigned_receipt_id;
        if (!orphansByReceipt[rid]) orphansByReceipt[rid] = [];
        orphansByReceipt[rid].push(p.tracking_number);
      });

      // Detalle por recibo y desglose de costos para pago por órdenes de despacho
      const manualRecibos = [
        ...selectedRows
          .filter((r) => r.invoice_number && r.invoice_number !== '—')
          .map((r) => ({
            cbm_ingreso_id: r.id,
            invoice_number: String(r.invoice_number),
            cbm: num(r.cbm),
            tracking_numbers: [...(r.tracking_numbers || []), ...(orphansByReceipt[r.id] || [])],
          })),
        ...(manualReceipt ? [{ cbm_ingreso_id: null, invoice_number: manualReceipt, cbm: manualReceiptCbm, tracking_numbers: [] }] : []),
      ];
      const costBreakdown = {
        total_cbm: totalCbmWithOrphans,
        billed_cbm: billedCbmValue,
        shipping_total: consolidatedShipping,
        insurance_total: insuranceTotal,
        consolidation_fee: consolidationFee,
        door_to_door_fee: doorToDoorValue,
        extra_amount: extraAmountValue,
        extra_concept: String(extraConcept || '').trim(),
        rate_per_cbm: ratePerCbm,
        orphan_packages_count: selOrphans.length,
      };

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + num(appConfig?.invoice_overdue_days || 7));

      const invoice = await base44.entities.Invoice.create({
        invoice_number: `INV-M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        client_email: client.email,
        consolidation_id: selectedRows[0]?.consolidation_id || 'manual',
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
        manual_recibos: manualRecibos,
        cost_breakdown: costBreakdown,
        notes: `Factura manual combinada generada desde ${sourceOrders.length} recibo(s): ${sourceOrders.join(', ')}. CBM total: ${totalCbmWithOrphans.toFixed(5)} | CBM facturado: ${billedCbmValue.toFixed(5)}${selOrphans.length > 0 ? ` | Paquetes sin recibo asignados: ${selOrphans.length} (${selOrphans.map((p) => p.tracking_number).join(', ')})` : ''}`,
      });

      // Marcar los registros de CBM usados como facturados
      // (disponible_entrega se activa al crear la orden de despacho, no al facturar)
      await Promise.all(selectedRows.map((r) =>
        base44.entities.CbmIngreso.update(r.id, { billed: true, billed_invoice_id: invoice.id })
      ));

      // Registrar el recibo nuevo como CbmIngreso ya facturado
      if (manualReceipt) {
        const newReceiptCbm = Math.max(billedCbmValue - totalCbm, 0);
        await base44.entities.CbmIngreso.create({
          fecha: new Date().toISOString(),
          cbm: newReceiptCbm,
          mes: new Date().toISOString().slice(0, 7),
          client_email: client.email,
          client_name: `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.full_name || client.email,
          shipping_mark: client.shipping_mark || '',
          invoice_number: manualReceipt,
          billed: true,
          billed_invoice_id: invoice.id,
        }).catch(() => {});
      }

      // Asignar paquetes sin recibo a sus recibos existentes (agregar tracking_numbers)
      const orphanGroups = Object.entries(orphansByReceipt);
      await Promise.all(orphanGroups.map(async ([receiptId, newTrackings]) => {
        const existing = await base44.entities.CbmIngreso.filter({ id: receiptId }).then((r) => r?.[0]).catch(() => null);
        if (!existing) return;
        const existingTrackings = existing.tracking_numbers || [];
        const merged = [...new Set([...existingTrackings, ...newTrackings])];
        await base44.entities.CbmIngreso.update(receiptId, {
          tracking_numbers: merged,
          billed: true,
          billed_invoice_id: invoice.id,
        }).catch(() => {});
      }));

      toast.success(`Factura ${invoice.invoice_number} generada`);

      // Notificar al cliente que tiene una nueva factura (no bloqueante)
      try {
        await base44.entities.Notification.create({
          user_email: client.email,
          title: '🧾 Nueva factura generada',
          message: `Tu factura ${invoice.invoice_number} por $${num(total).toFixed(2)} está disponible. Ingresa a Mis Facturas para revisar y pagar.`,
          type: 'payment',
          icon: 'dollar',
          reference_id: invoice.id,
          entity_type: 'Invoice'
        });
      } catch (_) {}

      // Enviar email al cliente (no bloqueante)
      try {
        await base44.functions.invoke('sendNotificationEmail', {
          to: client.email,
          subject: `Nueva factura ${invoice.invoice_number} - TLEC CARGO`,
          body: `Hola,\n\nSe ha generado una nueva factura a tu nombre.\n\nFactura: ${invoice.invoice_number}\nTotal: $${num(total).toFixed(2)}\n\nIngresa a tu portal de TLEC CARGO para revisar los métodos de pago disponibles y completar el pago.\n\nGracias.`,
          in_app: {
            title: 'Nueva factura generada',
            message: `Factura ${invoice.invoice_number} por $${num(total).toFixed(2)}`,
            type: 'payment',
            icon: 'dollar',
            reference_id: invoice.id
          }
        });
      } catch (_) {}

      // Generar cuenta por pagar al proveedor y calcular ganancia
      try {
        const res = await base44.functions.invoke('processInvoiceForAccounting', { invoiceId: invoice.id, providerInvoiceUrl: providerInvoiceUrl || '' });
        const profit = res?.data?.profit_amount;
        const cost = res?.data?.provider_cost_total;
        if (profit !== undefined) {
          toast.success(`Cuenta por pagar creada (costo proveedor $${num(cost).toFixed(2)}). Ganancia: $${num(profit).toFixed(2)}`, { duration: 8000 });
        }
      } catch {
        toast.warning('Factura creada, pero no se pudo generar la cuenta por pagar automáticamente');
      }
      // Aplicar saldo a favor del cliente si existe (automático)
      try {
        const creditRes = await base44.functions.invoke('applyClientCreditToInvoice', { invoice_id: invoice.id });
        const applied = creditRes?.data?.applied || [];
        if (applied.length > 0) {
          const msg = applied.map(a => `Factura ${a.invoice_number}: -$${num(a.applied).toFixed(2)}${a.fully_paid ? ' (pagada)' : ''}`).join(', ');
          toast.success(`Saldo a favor aplicado: ${msg}`, { duration: 8000 });
        }
        // Actualizar el saldo mostrado (quedarán 0 o el remanente)
        const remaining = creditRes?.data?.remaining_balance;
        setCreditBalance(Number(remaining) || 0);
      } catch {
        // Silencioso: el saldo se aplicará en otra oportunidad
      }
      // Quitar de la lista los registros ya facturados
      const billedIds = new Set(selectedRows.map((r) => r.id));
      setRows((prev) => prev.filter((r) => !billedIds.has(r.id)));
      // Quitar los paquetes sin recibo ya facturados
      const orphanIds = new Set(selOrphans.map((p) => p.id));
      setOrphanPackages((prev) => prev.filter((p) => !orphanIds.has(p.id)));
      setPaymentMethod('');
      setManualConsolidationFee('');
      setBilledCbm('');
      setManualInsurance('');
      setProviderInvoiceUrl('');
      setManualReceiptNumber('');
      setExtraAmount('');
      setExtraConcept('');
      setDoorToDoorFee('');
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

            {orphanPackages.length > 0 && (
              <PackagesWithoutReceiptSection
                packages={orphanPackages}
                onChange={setOrphanPackages}
                selectedRows={selectedRows}
              />
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
              autoInsuranceTotal={autoInsuranceTotal}
              manualInsurance={manualInsurance}
              setManualInsurance={setManualInsurance}
              total={total}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              appConfig={appConfig}
              onCreate={handleCreate}
              creating={creating}
              canCreate={selectedRows.length > 0 || (manualReceiptNumber.trim() !== '' && num(billedCbm) > 0) || orphanPackages.some((p) => p.selected)}
              billedCbm={billedCbm}
              setBilledCbm={setBilledCbm}
              manualReceiptNumber={manualReceiptNumber}
              setManualReceiptNumber={setManualReceiptNumber}
              providerInvoiceUrl={providerInvoiceUrl}
              setProviderInvoiceUrl={setProviderInvoiceUrl}
              extraAmount={extraAmount}
              setExtraAmount={setExtraAmount}
              extraConcept={extraConcept}
              setExtraConcept={setExtraConcept}
              doorToDoorFee={doorToDoorFee}
              setDoorToDoorFee={setDoorToDoorFee}
              creditBalance={creditBalance}
            />
          </div>
        </div>
      )}
    </div>
  );
}