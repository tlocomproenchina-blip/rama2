import { base44 } from '@/components/api/ApiQueueManager';

// =====================================================================
// Facturación de carga en almacén (Venezuela).
//
// Reutiliza EXACTAMENTE las reglas de Facturación Manual:
//  - envío por CBM con las tarifas vigentes a la fecha del recibo
//    (RateHistory + tarifa del estado del cliente + puerta a puerta)
//  - tarifas especiales para cargas menores a 0.130 CBM
//  - seguro sobre el FOB asegurado aún no pagado
//  - consolidación ($1 por paquete)
//
// La factura generada usa las mismas estructuras (manual_recibos +
// cost_breakdown) para que el pago por envío del cliente
// (getInvoiceDispatchOrders + DispatchOrderSelector) siga funcionando.
// =====================================================================

export const DOOR_TO_DOOR_THRESHOLD = 0.130;
export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const normTracking = (raw) => String(raw || '').split(/[:：]/).pop().trim().toUpperCase();

export function buildBillingContext({ pricing, appConfig, stateConfigs, rateHistory, clientState }) {
  const specialRates = [...(Array.isArray(appConfig?.special_cbm_rates) ? appConfig.special_cbm_rates : [])]
    .sort((x, y) => num(x.min_cbm) - num(y.min_cbm));

  const stateCode = String(clientState || '').trim().toLowerCase();
  const stateConfig = (stateConfigs || []).find((s) => String(s.state_code).toLowerCase() === stateCode);
  const stateShippingRate = num(stateConfig?.shipping_rate);

  const currentRateSet = {
    base_rate_regular: num(pricing?.base_rate_regular),
    base_rate_high_risk: num(pricing?.base_rate_high_risk),
    profit_percentage: num(pricing?.profit_percentage),
    door_to_door_cost: num(pricing?.door_to_door_cost),
    special_cbm_rates: specialRates,
    effective_date: null,
  };

  const getRateSetForDate = (fecha) => {
    if (!fecha || !rateHistory || rateHistory.length === 0) return currentRateSet;
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
      effective_date: chosen.effective_date,
    };
  };

  const computeRatePerCbm = (rateSet) => num(rateSet.base_rate_regular) * (1 + num(rateSet.profit_percentage) / 100)
    + stateShippingRate + num(rateSet.door_to_door_cost);

  const calcShippingForRow = (cbm, fecha) => {
    const c = num(cbm);
    if (c <= 0) return 0;
    const rateSet = getRateSetForDate(fecha);
    if (c >= DOOR_TO_DOOR_THRESHOLD) return c * computeRatePerCbm(rateSet);
    const specials = Array.isArray(rateSet.special_cbm_rates) ? rateSet.special_cbm_rates : [];
    const sorted = [...specials].sort((x, y) => num(x.min_cbm) - num(y.min_cbm));
    const found = sorted.find((r) => c <= num(r.max_cbm));
    return found ? num(found.rate_regular) : c * computeRatePerCbm(rateSet);
  };

  const getRateLabel = (fecha) => {
    if (!fecha || !rateHistory || rateHistory.length === 0) return 'actual';
    const latest = [...rateHistory].sort((a, b) => new Date(b.effective_date) - new Date(a.effective_date))[0];
    const resolved = getRateSetForDate(fecha);
    if (resolved.effective_date && latest && new Date(resolved.effective_date) < new Date(latest.effective_date)) {
      return 'anterior';
    }
    return 'actual';
  };

  // Envío consolidado: un solo cálculo sobre el CBM total facturado
  const calcConsolidatedShipping = (billedCbm, items) => {
    const c = num(billedCbm);
    if (c <= 0) return 0;
    if (c >= DOOR_TO_DOOR_THRESHOLD) {
      const totalReceiptCbm = (items || []).reduce((s, r) => s + num(r.cbm), 0);
      if (totalReceiptCbm <= 0) return c * computeRatePerCbm(currentRateSet);
      const groups = {};
      (items || []).forEach((r) => {
        if (num(r.cbm) <= 0) return;
        const rs = getRateSetForDate(r.fecha);
        const key = rs.effective_date || 'current';
        if (!groups[key]) groups[key] = { rateSet: rs, cbm: 0 };
        groups[key].cbm += num(r.cbm);
      });
      const scale = c / totalReceiptCbm;
      return Object.values(groups).reduce((sum, g) => sum + g.cbm * scale * computeRatePerCbm(g.rateSet), 0);
    }
    const withDates = (items || []).filter((r) => r.fecha);
    const rateSet = withDates.length > 0
      ? getRateSetForDate(withDates.reduce((max, r) => (new Date(r.fecha) > new Date(max.fecha) ? r : max)).fecha)
      : currentRateSet;
    const specials = Array.isArray(rateSet.special_cbm_rates) ? rateSet.special_cbm_rates : [];
    const sorted = [...specials].sort((x, y) => num(x.min_cbm) - num(y.min_cbm));
    const found = sorted.find((r) => c <= num(r.max_cbm));
    return found ? num(found.rate_regular) : 0;
  };

  const insuranceRate = (num(appConfig?.insurance_percentage) || 5) / 100;

  return {
    stateConfig,
    stateShippingRate,
    currentRateSet,
    getRateSetForDate,
    computeRatePerCbm,
    calcShippingForRow,
    getRateLabel,
    calcConsolidatedShipping,
    insuranceRate,
  };
}

// Convierte la carga del cliente en conceptos facturables con su monto individual.
export function buildBillableItems(client, ctx) {
  const insuredOf = (trackings) => {
    let fob = 0;
    let count = 0;
    for (const t of trackings || []) {
      const val = num(client?.insured_fob?.[normTracking(t)]);
      if (val > 0) { fob += val; count += 1; }
    }
    return { fob, count };
  };

  const decorate = (raw, type) => {
    const { fob, count } = insuredOf(raw.trackings);
    return {
      ...raw,
      type,
      fob,
      insured_count: count,
      insurance: Math.round(fob * ctx.insuranceRate * 100) / 100,
    };
  };

  return {
    bultos: (client?.bultos || []).map((b) => decorate(b, 'bulto')),
    receipts: (client?.receipts || []).map((r) => decorate(r, 'receipt')),
  };
}

// Monto estimado del cliente: lo que se facturaría con toda su carga pendiente.
export function computeClientEstimate(client, ctx) {
  const { bultos, receipts } = buildBillableItems(client, ctx);
  // Lo que se facturaría por defecto: bultos con CBM y recibos sin duplicar
  const items = [
    ...bultos.filter((b) => num(b.cbm) > 0),
    ...receipts.filter((r) => !r.overlap_bulto),
  ];
  const totals = computeSelectionTotals(items, ctx, {});
  return { ...totals, items_count: items.length };
}

export function computeSelectionTotals(items, ctx, overrides = {}) {
  const totalCbm = (items || []).reduce((s, i) => s + num(i.cbm), 0);
  const packages = (items || []).reduce((s, i) => s + num(i.package_count), 0);
  const billedCbm = overrides.billedCbm !== '' && overrides.billedCbm != null ? num(overrides.billedCbm) : totalCbm;
  const shipping = ctx.calcConsolidatedShipping(billedCbm, items);
  const autoInsurance = (items || []).reduce((s, i) => s + num(i.insurance), 0);
  const insurance = overrides.insurance !== '' && overrides.insurance != null ? num(overrides.insurance) : autoInsurance;
  const consolidation = overrides.consolidationMode === 'manual' ? num(overrides.consolidationFee) : packages * 1;
  const doorToDoor = num(overrides.doorToDoor);
  const extra = num(overrides.extraAmount);
  const total = shipping + insurance + consolidation + doorToDoor + extra;
  return {
    totalCbm,
    billedCbm,
    packages,
    shipping,
    autoInsurance,
    insurance,
    consolidation,
    doorToDoor,
    extra,
    extraConcept: overrides.extraConcept || '',
    total,
  };
}

// Reparte el envío y el seguro entre los conceptos (proporcional al CBM y al FOB).
export function distributeAmounts(items, totals) {
  const map = {};
  const cbmSum = (items || []).reduce((s, i) => s + num(i.cbm), 0);
  const insuranceSum = (items || []).reduce((s, i) => s + num(i.insurance), 0);
  for (const i of items || []) {
    const shipShare = cbmSum > 0 ? (num(i.cbm) / cbmSum) * totals.shipping : 0;
    const insShare = insuranceSum > 0 ? (num(i.insurance) / insuranceSum) * totals.insurance : 0;
    map[i.id] = Math.round((shipShare + insShare) * 100) / 100;
  }
  return map;
}

// Genera la factura combinada del cliente, marca lo incluido como facturado y avisa al cliente.
export async function generateWarehouseInvoice({ client, selectedItems, totals, appConfig, note }) {
  const now = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + num(appConfig?.invoice_overdue_days || 7));

  const ratePerCbm = totals.billedCbm > 0 ? totals.shipping / totals.billedCbm : 0;
  const labels = selectedItems.map((it) => it.label).filter(Boolean);

  const items = [];
  for (const it of selectedItems) {
    const cbm = num(it.cbm);
    items.push({
      description: `Envío ${it.label}`,
      quantity: cbm,
      unit_price: ratePerCbm,
      total: cbm * ratePerCbm,
      details: {
        cbm,
        invoice_number: it.label,
        source_invoices: [it.label],
        bulto_label: it.type === 'bulto' ? it.label : undefined,
      },
    });
  }
  for (const it of selectedItems) {
    if (num(it.insurance) > 0) {
      items.push({
        description: `Seguro de carga - ${it.label}`,
        quantity: 1,
        unit_price: num(it.insurance),
        total: num(it.insurance),
        details: { fob_value: num(it.fob), insured_packages: num(it.insured_count) },
      });
    }
  }
  if (num(totals.consolidation) > 0) {
    items.push({
      description: `Servicio de consolidación ($1 × ${num(totals.packages)} paquetes)`,
      quantity: num(totals.packages),
      unit_price: 1,
      total: num(totals.consolidation),
      details: { package_count: num(totals.packages) },
    });
  }
  if (num(totals.doorToDoor) > 0) {
    items.push({
      description: 'Envío puerta a puerta',
      quantity: 1,
      unit_price: num(totals.doorToDoor),
      total: num(totals.doorToDoor),
      details: { door_to_door: true },
    });
  }
  if (num(totals.extra) > 0) {
    items.push({
      description: totals.extraConcept || 'Monto adicional',
      quantity: 1,
      unit_price: num(totals.extra),
      total: num(totals.extra),
      details: { extra_charge: true },
    });
  }

  const manualRecibos = selectedItems.map((it) => ({
    cbm_ingreso_id: it.type === 'receipt' ? it.id : null,
    invoice_number: String(it.label),
    cbm: num(it.cbm),
    tracking_numbers: it.trackings || [],
  }));

  const invoice = await base44.entities.Invoice.create({
    invoice_number: `INV-M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    client_email: client.client_email,
    consolidation_id: 'manual',
    consolidation_tracking: labels.join(', '),
    invoice_date: now.toISOString(),
    due_date: dueDate.toISOString(),
    items,
    subtotal: num(totals.total),
    tax: 0,
    total: num(totals.total),
    status: 'pendiente',
    billed_cbm: num(totals.billedCbm),
    total_cbm: num(totals.totalCbm),
    manual_recibos: manualRecibos,
    cost_breakdown: {
      total_cbm: num(totals.totalCbm),
      billed_cbm: num(totals.billedCbm),
      shipping_total: num(totals.shipping),
      insurance_total: num(totals.insurance),
      paid_insurance_total: 0,
      consolidation_fee: num(totals.consolidation),
      door_to_door_fee: num(totals.doorToDoor),
      extra_amount: num(totals.extra),
      extra_concept: totals.extraConcept || '',
      rate_per_cbm: ratePerCbm,
      orphan_packages_count: 0,
    },
    notes: note || `Carga en almacén (Venezuela) facturada desde Gestión de Facturas. Envíos: ${labels.join(', ')}. CBM total: ${num(totals.totalCbm).toFixed(5)} | CBM facturado: ${num(totals.billedCbm).toFixed(5)}`,
  });

  // Marcar lo incluido como facturado
  const receiptIds = selectedItems.filter((it) => it.type === 'receipt').map((it) => it.id);
  const bultoIds = selectedItems.filter((it) => it.type === 'bulto').map((it) => it.id);
  await Promise.all([
    ...receiptIds.map((id) => base44.entities.CbmIngreso.update(id, { billed: true, billed_invoice_id: invoice.id })),
    ...bultoIds.map((id) => base44.entities.Bulto.update(id, {
      billed_invoice_id: invoice.id,
      billed_date: now.toISOString(),
      invoice_number: invoice.invoice_number,
      invoice_status: 'pendiente',
      invoice_paid: false,
    })),
  ]);

  const amount = `$${num(totals.total).toFixed(2)}`;

  // Aviso al cliente: notificación in-app + email
  try {
    await base44.functions.invoke('sendNotificationEmail', {
      to: client.client_email,
      subject: `Nueva factura ${invoice.invoice_number} - TLEC CARGO`,
      body: `Hola,\n\nSe generó tu factura para la carga disponible en almacén.\n\nFactura: ${invoice.invoice_number}\nEnvíos: ${labels.join(', ')}\nCBM: ${num(totals.billedCbm).toFixed(4)}\nTotal: ${amount}\n\nIngresa a tu portal de TLEC CARGO, en "Mis Facturas", para revisar el detalle y pagar tus envíos disponibles para entrega.\n\nGracias.`,
      in_app: {
        user_email: client.client_email,
        title: '🧾 Nueva factura generada',
        message: `Tu factura ${invoice.invoice_number} por ${amount} está disponible. Ingresa a Mis Facturas para revisar y pagar.`,
        type: 'payment',
        icon: 'dollar',
        reference_id: invoice.id,
        entity_type: 'Invoice',
      },
    });
  } catch (_) {
    // El aviso es best-effort: la factura ya quedó creada
  }

  // Cuenta por pagar + ganancia (misma mecánica que Facturación Manual)
  try {
    await base44.functions.invoke('processInvoiceForAccounting', { invoiceId: invoice.id, providerInvoiceUrl: '' });
  } catch (_) {}

  // Saldo a favor del cliente
  try {
    await base44.functions.invoke('applyClientCreditToInvoice', { invoice_id: invoice.id });
  } catch (_) {}

  return invoice;
}