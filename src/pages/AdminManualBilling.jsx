import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ReceiptText, RotateCcw, AlertTriangle, Package, ChevronDown, Boxes } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ClientSearchBox from '@/components/manual-billing/ClientSearchBox';
import ClientInfoCard from '@/components/manual-billing/ClientInfoCard';
import ClientStateRatesCard from '@/components/manual-billing/ClientStateRatesCard';
import BillingInvoiceRow from '@/components/manual-billing/BillingInvoiceRow';
import BillingSummary from '@/components/manual-billing/BillingSummary';
import PackagesWithoutReceiptSection from '@/components/manual-billing/PackagesWithoutReceiptSection';
import DuplicateReceiptsBanner from '@/components/manual-billing/DuplicateReceiptsBanner';
import DuplicateMergeDialog from '@/components/manual-billing/DuplicateMergeDialog';
import ReceiptsAutoMergeNotice from '@/components/manual-billing/ReceiptsAutoMergeNotice';
import PendingBillingPanel from '@/components/manual-billing/PendingBillingPanel';
import BilledReceiptsSection from '@/components/manual-billing/BilledReceiptsSection';
import usePendingBillingClients from '@/hooks/usePendingBillingClients';
import ClientPendingLoad from '@/components/manual-billing/ClientPendingLoad';
import MobileBillingSummary from '@/components/manual-billing/MobileBillingSummary';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Tipo de carga con el que arranca la factura; cada recibo puede tener el suyo
const INITIAL_CARGO_TYPE = 'general';

export default function AdminManualBilling({ user }) {
  const [appConfig, setAppConfig] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [stateConfigs, setStateConfigs] = useState([]);
  const [client, setClient] = useState(null);
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [consolidationMode, setConsolidationMode] = useState('auto');
  // Tipo de carga de la factura: 'general' (regular, predeterminado) o 'alto_riesgo'
  const [cargoType, setCargoType] = useState('general');
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
  const [approvedInsuranceByTracking, setApprovedInsuranceByTracking] = useState({});
  const [dupGroups, setDupGroups] = useState([]);
  const [dupGlobal, setDupGlobal] = useState(false);
  const [scanningDups, setScanningDups] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [autoMerging, setAutoMerging] = useState(false);
  const [autoSummary, setAutoSummary] = useState(null);
  // Cliente ya revisado automáticamente (evita repetir la fusión en cada recarga)
  const autoRanRef = useRef(null);
  const clientEmailRef = useRef('');
  // Panel de carga pendiente: clientes con bultos sin factura vigente
  const pending = usePendingBillingClients();
  // En móvil el panel arranca plegado para no empujar la facturación fuera de pantalla
  const [showPending, setShowPending] = useState(false);
  // Envíos marcados a mano como ya facturados: no se borran, se agrupan aparte
  const [markedReceipts, setMarkedReceipts] = useState([]);
  const [markingReceiptId, setMarkingReceiptId] = useState(null);

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

  // Al entrar a la pantalla se avisan los repetidos que no se pueden resolver solos
  // (CBM distinto o ya facturados) en cualquier cliente. No modifica nada.
  useEffect(() => {
    checkPendingDuplicates();
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

  // Tarifa por CBM (>= 0.130) para un set de tarifas dado,
  // usando la tarifa base regular o de alto riesgo según el tipo de carga elegido
  const computeRatePerCbm = useCallback((rateSet, type = cargoType) => {
    const factor = 1 + num(rateSet.profit_percentage) / 100;
    const baseRate = type === 'alto_riesgo' ? rateSet.base_rate_high_risk : rateSet.base_rate_regular;
    return num(baseRate) * factor + stateShippingRate + num(rateSet.door_to_door_cost);
  }, [stateShippingRate, cargoType]);

  // Tarifa de la tabla de mínimos (< 0.130 CBM) según el tipo de carga elegido
  const specialRateFor = useCallback((range, type = cargoType) => (
    type === 'alto_riesgo' ? num(range?.rate_high_risk) : num(range?.rate_regular)
  ), [cargoType]);

  // Calcula el monto de envío de un recibo individual según su fecha de llegada
  // y su tipo de carga (el propio del recibo o el de la factura si no tiene)
  const calcShippingForRow = useCallback((cbm, fecha, type = cargoType) => {
    const c = num(cbm);
    if (c <= 0) return 0;
    const rateSet = getRateSetForDate(fecha);
    if (c >= DOOR_TO_DOOR_THRESHOLD) {
      return c * computeRatePerCbm(rateSet, type);
    }
    const specials = Array.isArray(rateSet.special_cbm_rates) ? rateSet.special_cbm_rates : [];
    const sorted = [...specials].sort((x, y) => num(x.min_cbm) - num(y.min_cbm));
    const found = sorted.find((r) => c <= num(r.max_cbm));
    return found ? specialRateFor(found, type) : c * computeRatePerCbm(rateSet, type);
  }, [getRateSetForDate, computeRatePerCbm, specialRateFor, cargoType]);

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
  const calcConsolidatedShipping = useCallback((billedCbm, selected, fallbackType = cargoType) => {
    const c = num(billedCbm);
    if (c <= 0) return 0;
    // Tipo de carga de cada recibo: el suyo propio o el elegido a nivel de factura
    const typeOf = (r) => r.cargo_type || fallbackType;
    if (c >= DOOR_TO_DOOR_THRESHOLD) {
      const totalReceiptCbm = selected.reduce((s, r) => s + num(r.cbm), 0);
      if (totalReceiptCbm <= 0) {
        return c * computeRatePerCbm(currentRateSet, fallbackType);
      }
      // Agrupar CBM por set de tarifa (resuelto por fecha del recibo) y tipo de carga
      const groups = {};
      selected.forEach((r) => {
        if (num(r.cbm) <= 0) return;
        const type = typeOf(r);
        const rs = getRateSetForDate(r.fecha);
        const key = `${rs.effective_date || 'current'}|${type}`;
        if (!groups[key]) groups[key] = { rateSet: rs, type, cbm: 0 };
        groups[key].cbm += num(r.cbm);
      });
      // Escalar al CBM facturado si difiere del total de recibos
      const scale = totalReceiptCbm > 0 ? c / totalReceiptCbm : 1;
      return Object.values(groups).reduce((sum, g) => sum + g.cbm * scale * computeRatePerCbm(g.rateSet, g.type), 0);
    }
    // Tarifa especial fija: usar la tarifa del recibo más reciente con fecha
    const withDates = selected.filter((r) => r.fecha);
    const ref = withDates.length > 0
      ? withDates.reduce((max, r) => new Date(r.fecha) > new Date(max.fecha) ? r : max)
      : null;
    const rateSet = ref ? getRateSetForDate(ref.fecha) : currentRateSet;
    const type = ref ? typeOf(ref) : fallbackType;
    const specials = Array.isArray(rateSet.special_cbm_rates) ? rateSet.special_cbm_rates : [];
    const sorted = [...specials].sort((x, y) => num(x.min_cbm) - num(y.min_cbm));
    const found = sorted.find((r) => c <= num(r.max_cbm));
    return found ? specialRateFor(found, type) : 0;
  }, [getRateSetForDate, computeRatePerCbm, currentRateSet, specialRateFor, cargoType]);

  // Recalcular envío de las filas cuando cambian las tarifas o el historial
  useEffect(() => {
    setRows((prev) => prev.map((r) => ({
      ...r,
      shipping_amount: calcShippingForRow(r.cbm, r.fecha, r.cargo_type || cargoType).toFixed(2),
      rate_label: getRateLabel(r.fecha)
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalRatePerCbm, specialRates, rateHistory, stateShippingRate, cargoType]);

  const loadClientInvoices = async (selectedClient, options = {}) => {
    const skipAuto = options?.skipAuto === true;
    setClient(selectedClient);
    setRows([]);
    setMarkedReceipts([]);
    setCargoType(INITIAL_CARGO_TYPE);
    setCreditBalance(0);
    setOrphanPackages([]);
    setDupGroups([]);
    setAutoSummary(null);
    clientEmailRef.current = String(selectedClient?.email || '').trim();
    setLoadingRows(true);
    try {
      const [ingresos, pkgs, credits, dispatchOrders, insurancePayments] = await Promise.all([
        base44.entities.CbmIngreso.filter({ client_email: selectedClient.email }, '-fecha', 200),
        base44.entities.Package.filter({ client_email: selectedClient.email }, '-created_date', 500).catch(() => []),
        base44.entities.ClientCredit.filter({ client_email: selectedClient.email }).catch(() => []),
        base44.entities.DispatchOrder.filter({ client_email: selectedClient.email }, '-dispatched_date', 500).catch(() => []),
        base44.entities.InsurancePayment.filter({ client_email: selectedClient.email, status: 'aprobado' }, '-created_date', 500).catch(() => []),
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

      // Mapa de seguros ya pagados (aprobados) por tracking normalizado
      const approvedMap = {};
      (insurancePayments || []).forEach((ip) => {
        const t = normTracking(ip.tracking_number);
        if (t) approvedMap[t] = { amount: num(ip.amount), fob: num(ip.fob_value) };
      });
      setApprovedInsuranceByTracking(approvedMap);

      // Mapa de FOB asegurado por número de tracking normalizado (desde los paquetes con seguro)
      // EXCLUYENDO los trackings que ya tienen seguro pagado y aprobado (no se vuelve a cobrar)
      const insuredFobByTracking = {};
      (pkgs || []).forEach((p) => {
        if (!p.has_insurance) return;
        const fob = num(p.fob_value);
        if (fob <= 0) return;
        String(p.tracking_number || '')
          .split(/[，,;|]+/)
          .map(normTracking)
          .filter(Boolean)
          .forEach((t) => {
            if (approvedMap[t]) return; // ya pagado, no se cobra de nuevo
            insuredFobByTracking[t] = Math.max(insuredFobByTracking[t] || 0, fob);
          });
      });

      // Excluir registros que ya fueron facturados (solo se liberan al desconsolidar)
      // y los marcados a mano como ya facturados por fuera (siguen visibles aparte)
      const available = (ingresos || []).filter((ing) => !ing.billed && ing.billing_marked !== true);

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
        .map((p) => {
          const t = normTracking(p.tracking_number);
          const paidIns = approvedMap[t]?.amount || 0;
          return {
            id: p.id,
            tracking_number: p.tracking_number,
            fob_value: num(p.fob_value),
            has_insurance: !!p.has_insurance,
            has_paid_insurance: paidIns > 0,
            paid_insurance_amount: paidIns,
            selected: false,
            assigned_receipt_id: '',
          };
        });
      setOrphanPackages(orphans);

      const built = available.map((ing) => {
        const cbm = num(ing.cbm);
        const trackings = ing.tracking_numbers || [];
        // FOB asegurado: usar fob_total del registro o, si falta, sumar el FOB de los paquetes asegurados que coincidan por tracking
        const trackingFob = trackings.reduce((s, t) => s + (insuredFobByTracking[normTracking(t)] || 0), 0);
        const insuredCount = trackings.filter((t) => (insuredFobByTracking[normTracking(t)] || 0) > 0).length;
        const totalFob = trackingFob;
        // Seguro ya pagado (aprobado) para los trackings de este recibo
        const paidInsurance = trackings.reduce((s, t) => s + (approvedMap[normTracking(t)]?.amount || 0), 0);
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
          // null = hereda el tipo de carga elegido en la factura
          cargo_type: null,
          cbm_original: cbm,
          cbm: cbm ? cbm.toFixed(4) : '',
          shipping_amount: calcShippingForRow(cbm, ing.fecha, INITIAL_CARGO_TYPE).toFixed(2),
          rate_label: getRateLabel(ing.fecha),
          insurance_amount: (totalFob * 0.05).toFixed(2),
          paid_insurance_amount: paidInsurance,
        };
      });
      setRows(built);
      // Envíos marcados a mano como ya facturados: se conservan (con su CBM y
      // trackings intactos) agrupados en su propia sección, fuera de la facturable.
      setMarkedReceipts((ingresos || [])
        .filter((ing) => ing.billing_marked === true)
        .map((ing) => ({
          id: ing.id,
          order: ing.invoice_number || ing.descripcion || '—',
          cbm: num(ing.cbm),
          package_count: num(ing.package_count) || (ing.tracking_numbers || []).length,
          trackings: ing.tracking_numbers || [],
          fecha: ing.fecha || null,
          billing_marked_by: ing.billing_marked_by || '',
          billing_marked_date: ing.billing_marked_date || null,
        })));
      // Con los recibos ya cargados, se revisan y fusionan los repetidos del
      // cliente en segundo plano, sin bloquear la pantalla.
      if (!skipAuto) autoMergeDuplicates(selectedClient);
    } catch {
      toast.error('Error al cargar registros del cliente');
    }
    setLoadingRows(false);
  };

  // Cliente elegido en el panel: se cargan sus registros igual que con el buscador
  const selectPendingClient = (pendingClient) => {
    loadClientInvoices({
      email: pendingClient.client_email,
      full_name: pendingClient.client_name,
      shipping_mark: pendingClient.shipping_mark || '',
      whatsapp: pendingClient.whatsapp || '',
      cedula: pendingClient.cedula || '',
      address: pendingClient.address || '',
      city: pendingClient.city || '',
      state: pendingClient.state || '',
    });
  };

  // Marca manual de un N° de orden/envío: deja de ofrecerse como pendiente sin facturar
  const handleMarkBulto = async (bulto, marked) => {
    const res = await pending.markBulto(bulto, marked);
    if (res.ok) {
      toast.success(marked
        ? `Bulto ${bulto.label} marcado como facturado`
        : `Bulto ${bulto.label} vuelve a pendientes`);
    } else {
      toast.error(res.error);
    }
  };

  // Marca de una vez todo el envío: todos los bultos de un N° de orden se guardan en
  // secuencia (avance visible en la pestaña) y deja el envío completo como facturado.
  const handleMarkOrderBultos = async (bultos, marked, onProgress) => {
    const res = await pending.markBultos(bultos, marked, onProgress);
    if (res.count > 0) {
      toast.success(marked
        ? `${res.count} bulto(s) del envío marcados como facturados`
        : `${res.count} bulto(s) del envío vuelven a pendientes`);
    }
    if (res.failed > 0) toast.error(`No se pudieron guardar ${res.failed} bulto(s) del envío`);
    return res;
  };

  // Marca manual de un envío/recibo: se guarda como ya facturado (usuario y fecha)
  // sin borrarlo ni tocar su CBM, sus trackings o su estado billed.
  const handleMarkReceipt = async (receipt, marked) => {
    const order = receipt.order || receipt.invoice_number || receipt.label || '';
    setMarkingReceiptId(receipt.id);
    try {
      const markDate = new Date().toISOString();
      await base44.entities.CbmIngreso.update(receipt.id, marked
        ? { billing_marked: true, billing_marked_by: user?.email || '', billing_marked_date: markDate }
        : { billing_marked: false, billing_marked_by: '', billing_marked_date: null });

      if (marked) {
        // Sale de la lista facturable y pasa a la sección de ya facturados
        const snapshot = rows.find((r) => r.id === receipt.id);
        setRows((prev) => prev.filter((r) => r.id !== receipt.id));
        if (snapshot) {
          setMarkedReceipts((prev) => [{
            id: snapshot.id,
            order: snapshot.invoice_number,
            cbm: num(snapshot.cbm_original),
            package_count: snapshot.package_count || 0,
            trackings: snapshot.tracking_numbers || [],
            fecha: snapshot.fecha || null,
            billing_marked_by: user?.email || '',
            billing_marked_date: markDate,
            // Copia del recibo tal como estaba: permite devolverlo al instante
            snapshot: { ...snapshot, selected: false },
          }, ...prev]);
        } else if (client) {
          await loadClientInvoices(client, { skipAuto: true });
        }
      } else {
        // Vuelve de inmediato a la lista facturable
        const entry = markedReceipts.find((m) => m.id === receipt.id);
        setMarkedReceipts((prev) => prev.filter((m) => m.id !== receipt.id));
        if (entry?.snapshot) setRows((prev) => [{ ...entry.snapshot, selected: false }, ...prev]);
        else if (client) await loadClientInvoices(client, { skipAuto: true });
      }

      toast.success(marked
        ? `Envío ${order} marcado como ya facturado`
        : `Envío ${order} vuelve a la lista facturable`);
      pending.reload();
    } catch {
      toast.error('No se pudo guardar la marca del envío');
    }
    setMarkingReceiptId(null);
  };

  const updateRow = (updated) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== updated.id) return r;
      // Recalculate shipping when CBM or the receipt's cargo type changes
      if (updated.cbm !== r.cbm || updated.cargo_type !== r.cargo_type) {
        updated.shipping_amount = calcShippingForRow(updated.cbm, updated.fecha, updated.cargo_type || cargoType).toFixed(2);
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
  // Seguro de paquetes sin recibo: 5% del FOB solo si el cliente marcó asegurar y NO tiene seguro ya pagado
  const orphanInsuranceTotal = selectedOrphans.reduce((s, p) => s + (p.has_insurance && !p.has_paid_insurance ? num(p.fob_value) * 0.05 : 0), 0);
  const orphanPaidInsuranceTotal = selectedOrphans.reduce((s, p) => s + num(p.paid_insurance_amount || 0), 0);
  const insuranceTotal = manualInsurance !== '' ? num(manualInsurance) : (autoInsuranceTotal + orphanInsuranceTotal);
  // Seguro ya pagado y aprobado (referencia, NO se suma al total)
  const paidInsuranceTotal = selectedRows.reduce((s, r) => s + num(r.paid_insurance_amount), 0) + orphanPaidInsuranceTotal;
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
      const flatRatePerCbm = billedCbmValue > 0 ? consolidatedShipping / billedCbmValue : 0;
      // Tipo de carga efectivo de cada recibo (el suyo o el de la factura)
      const rowTypeOf = (r) => r.cargo_type || cargoType;
      const isLinearShipping = billedCbmValue >= DOOR_TO_DOOR_THRESHOLD;
      // Cada recibo (envío) se muestra como su propia línea con su CBM y la tarifa de su tipo de carga.
      // Para >= 0.130 CBM se escalan las tarifas por tipo para que el detalle sume el envío consolidado.
      const rowLines = selectedRows
        .filter((r) => r.invoice_number && r.invoice_number !== '—')
        .map((r) => ({ row: r, cbm: num(r.cbm), rate: computeRatePerCbm(getRateSetForDate(r.fecha), rowTypeOf(r)) }));
      const manualLine = manualReceipt
        ? { cbm: manualReceiptCbm, rate: computeRatePerCbm(currentRateSet, cargoType) }
        : null;
      const baseLinesSum = rowLines.reduce((s, l) => s + l.cbm * l.rate, 0) + (manualLine ? manualLine.cbm * manualLine.rate : 0);
      const typeScale = isLinearShipping && baseLinesSum > 0 ? consolidatedShipping / baseLinesSum : null;
      const lineRate = (rate) => (typeScale !== null ? rate * typeScale : flatRatePerCbm);

      rowLines.forEach(({ row: r, cbm, rate }) => {
        const unit = lineRate(rate);
        items.push({
          description: `Envío ${r.invoice_number}`,
          quantity: cbm,
          unit_price: unit,
          total: cbm * unit,
          details: { cbm, invoice_number: r.invoice_number, source_invoices: [r.invoice_number], cargo_type: rowTypeOf(r) },
        });
      });
      if (manualLine) {
        const manualUnit = lineRate(manualLine.rate);
        items.push({
          description: `Envío ${manualReceipt}`,
          quantity: manualLine.cbm,
          unit_price: manualUnit,
          total: manualLine.cbm * manualUnit,
          details: { cbm: manualLine.cbm, invoice_number: manualReceipt, source_invoices: [manualReceipt], cargo_type: cargoType },
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
          // Seguro ya pagado: línea de referencia con monto 0 (no se cobra de nuevo)
          if (num(r.paid_insurance_amount) > 0) {
            items.push({
              description: `Seguro ya pagado (referencia) - ${r.consolidation_tracking || r.invoice_number}`,
              quantity: 1,
              unit_price: 0,
              total: 0,
              details: { paid_insurance: num(r.paid_insurance_amount), reference_only: true },
            });
          }
        });
        // Seguro de paquetes sin recibo (5% FOB) solo si el cliente marcó asegurar y NO tiene seguro ya pagado
        selOrphans.forEach((p) => {
          if (!p.has_insurance) return;
          if (p.has_paid_insurance) {
            // Referencia de seguro ya pagado (no se cobra)
            items.push({
              description: `Seguro ya pagado (referencia) - ${p.tracking_number}`,
              quantity: 1,
              unit_price: 0,
              total: 0,
              details: { paid_insurance: num(p.paid_insurance_amount), reference_only: true, orphan_package: true },
            });
            return;
          }
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
            cargo_type: rowTypeOf(r),
            tracking_numbers: [...(r.tracking_numbers || []), ...(orphansByReceipt[r.id] || [])],
          })),
        ...(manualReceipt ? [{ cbm_ingreso_id: null, invoice_number: manualReceipt, cbm: manualReceiptCbm, cargo_type: cargoType, tracking_numbers: [] }] : []),
      ];
      const costBreakdown = {
        total_cbm: totalCbmWithOrphans,
        billed_cbm: billedCbmValue,
        shipping_total: consolidatedShipping,
        insurance_total: insuranceTotal,
        paid_insurance_total: paidInsuranceTotal,
        consolidation_fee: consolidationFee,
        door_to_door_fee: doorToDoorValue,
        extra_amount: extraAmountValue,
        extra_concept: String(extraConcept || '').trim(),
        rate_per_cbm: flatRatePerCbm,
        cargo_type: cargoType,
        cargo_type_per_receipt: Object.fromEntries(
          rowLines.map(({ row: r }) => [String(r.invoice_number), rowTypeOf(r)])
        ),
        mixed_cargo_types: rowLines.some(({ row: r }) => rowTypeOf(r) !== cargoType),
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
      setCargoType(INITIAL_CARGO_TYPE);
      // La carga facturada sale de la lista de pendientes del panel
      pending.reload();
    } catch {
      toast.error('Error al generar la factura');
    }
    setCreating(false);
  };

  // Repetidos que no se pueden fusionar solos (CBM distinto o ya facturados).
  const checkPendingDuplicates = async (email) => {
    setScanningDups(true);
    try {
      const res = await base44.functions.invoke('mergeDuplicateReceipts', {
        mode: 'auto',
        dry_run: true,
        ...(email ? { client_email: email } : {}),
      });
      const data = res?.data || {};
      setDupGroups(data.review || []);
      setDupGlobal(!email);
      return data.review || [];
    } catch {
      return [];
    } finally {
      setScanningDups(false);
    }
  };

  // Fusiona solos los repetidos del mismo cliente con igual N° de orden y CBM.
  const autoMergeDuplicates = async (selectedClient, force = false) => {
    const email = String(selectedClient?.email || '').trim();
    if (!email) return;
    if (!force && autoRanRef.current === email) return;
    autoRanRef.current = email;
    setAutoMerging(true);
    try {
      const res = await base44.functions.invoke('mergeDuplicateReceipts', { mode: 'auto', client_email: email });
      const data = res?.data || {};
      const merged = data.merged || [];
      if (merged.length && clientEmailRef.current === email) {
        await loadClientInvoices(selectedClient, { skipAuto: true });
      }
      setDupGroups(data.review || []);
      if (merged.length) {
        setAutoSummary({
          receipts: data.summary?.merged_receipts || 0,
          groups: merged.map((m) => ({ order: m.order, cbm: m.cbm_after })),
        });
      }
    } catch {
      // Silencioso: la revisión manual sigue disponible en el botón superior.
    } finally {
      setAutoMerging(false);
    }
  };

  // Revisión manual de todos los clientes: muestra los grupos y los fusiona con confirmación.
  const handleReviewAllDuplicates = async () => {
    setScanningDups(true);
    let found = [];
    try {
      const res = await base44.functions.invoke('mergeDuplicateReceipts', { mode: 'scan' });
      found = res?.data?.groups || [];
      setDupGroups(found);
      setDupGlobal(true);
    } catch {
      found = [];
    }
    setScanningDups(false);
    if (!found.length) {
      toast.success('No hay recibos repetidos');
      return;
    }
    setShowMergeDialog(true);
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

  // Cola visible del panel: solo clientes con al menos un bulto pendiente de facturar.
  // Al marcar el último bulto de un cliente, sale de aquí en el momento.
  const pendingQueue = useMemo(
    () => pending.clients.filter((c) => (c.bultos || []).some((b) => !b.billing_marked)),
    [pending.clients]
  );

  // Carga del cliente abierto (bultos pendientes y ya marcados), desde el panel
  const selectedPending = useMemo(
    () => pending.clients.find((c) => c.client_email === client?.email) || null,
    [pending.clients, client]
  );

  // El resumen de facturación se usa dos veces: fijo a la derecha en escritorio y
  // desplegable en la barra inferior en móvil/tablet.
  const billingSummary = (
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
      paidInsuranceTotal={paidInsuranceTotal}
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
  );

  return (
    <div className="mb-dark -m-4 min-h-[70dvh] space-y-5 overflow-x-hidden bg-slate-950 p-4 pb-28 text-slate-100 md:-m-6 md:p-6 lg:-m-8 lg:p-8 xl:pb-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-400/80">
            <ReceiptText className="h-3.5 w-3.5" /> Facturación manual
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">
            Armar la factura del cliente
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            A la izquierda está la carga que sigue en el almacén sin facturar. Elige un cliente, revisa sus N° de orden y arma su factura aquí mismo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleReviewAllDuplicates}
            disabled={scanningDups}
            className="border-white/15 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            {scanningDups ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
            Revisar duplicados
          </Button>
          <Button
            variant="outline"
            onClick={handleRecoverOrphans}
            disabled={recovering}
            className="border-white/15 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            {recovering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Recuperar registros huérfanos
          </Button>
        </div>
      </motion.div>

      {/* Móvil y tablet: la carga pendiente se despliega sobre el expediente */}
      <Button
        variant="outline"
        className="w-full justify-between border-white/15 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white xl:hidden"
        onClick={() => setShowPending((v) => !v)}
      >
        <span className="inline-flex items-center gap-2">
          <Package className="h-4 w-4" /> Carga pendiente ({pendingQueue.length} cliente(s))
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${showPending ? 'rotate-180' : ''}`} />
      </Button>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[19rem_minmax(0,1fr)_22rem]">
        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
          className={showPending ? 'block' : 'hidden xl:sticky xl:top-20 xl:block'}
        >
          <PendingBillingPanel
            clients={pending.clients}
            loading={pending.loading}
            error={pending.error}
            selectedEmail={client?.email}
            onRetry={pending.reload}
            onSelectClient={selectPendingClient}
          />
        </motion.aside>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.12 }}
          className="min-w-0 space-y-4"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <ClientSearchBox onSelect={loadClientInvoices} />
          </div>

      <DuplicateReceiptsBanner
        groups={dupGroups}
        scanning={scanningDups}
        hasClient={!!client}
        onOpen={() => setShowMergeDialog(true)}
        onRescan={() => (client ? autoMergeDuplicates(client, true) : checkPendingDuplicates())}
      />

      <ReceiptsAutoMergeNotice
        merging={autoMerging}
        summary={autoSummary}
        onDismiss={() => setAutoSummary(null)}
      />

      {!client ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
          <Boxes className="mx-auto h-8 w-8 text-slate-500" />
          <p className="mt-3 font-display text-sm font-semibold text-slate-200">Elige un cliente de la carga pendiente</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
            Su expediente se abre aquí con la carga del almacén por N° de orden, y el resumen de facturación queda siempre a la derecha.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
            <ClientInfoCard client={client} onClear={() => { setClient(null); setRows([]); setDupGroups([]); setAutoSummary(null); }} />
            <ClientStateRatesCard
              client={client}
              stateConfigs={stateConfigs}
              appConfig={appConfig}
              pricing={pricing}
              cargoType={cargoType}
              onCargoTypeChange={setCargoType}
            />

            {selectedPending && (
              <ClientPendingLoad
                client={selectedPending}
                markingId={pending.markingId}
                onMarkBulto={handleMarkBulto}
                onMarkOrderBultos={handleMarkOrderBultos}
              />
            )}

            <p className="pt-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
              Recibos registrados por facturar
            </p>

            {loadingRows ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : rows.length === 0 && markedReceipts.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
                  Este cliente no tiene registros de CBM.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {rows.map((row) => (
                  <BillingInvoiceRow
                    key={row.id}
                    row={row}
                    onChange={updateRow}
                    cargoType={cargoType}
                    marking={markingReceiptId === row.id}
                    onMarkReceipt={(r) => handleMarkReceipt(r, true)}
                  />
                ))}
              </div>
            )}

            {orphanPackages.length > 0 && (
              <PackagesWithoutReceiptSection
                packages={orphanPackages}
                onChange={setOrphanPackages}
                availableReceipts={rows}
                onAssignReceipt={(receiptId) => setRows((prev) => prev.map((r) => r.id === receiptId ? { ...r, selected: true } : r))}
              />
            )}

            <BilledReceiptsSection
              receipts={markedReceipts}
              markingId={markingReceiptId}
              onUnmark={(r) => handleMarkReceipt(r, false)}
            />
        </div>
      )}

      </motion.section>

        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.19 }}
          className="hidden xl:sticky xl:top-20 xl:block"
        >
          {billingSummary}
        </motion.aside>
      </div>

      {client && (
        <MobileBillingSummary total={total}>
          {billingSummary}
        </MobileBillingSummary>
      )}

      <DuplicateMergeDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        groups={dupGroups}
        showClient={dupGlobal}
        onDone={() => {
          if (client) loadClientInvoices(client, { skipAuto: true });
          else checkPendingDuplicates();
        }}
      />
    </div>
  );
}