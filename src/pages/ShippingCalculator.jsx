import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Plane, Ship, Package, Loader2 } from 'lucide-react';
import { normalizeStates, findStateByCodeOrName } from '@/components/utils/states';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import ClientSectionHeader from '@/components/client-portal/ClientSectionHeader';

export default function ShippingCalculator({ user, defaultStateCode, defaultShippingType }) {
  const [config, setConfig] = useState(null);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [loading, setLoading] = useState(true);
  const [shippingType, setShippingType] = useState('aereo');
  const [cargoCategory, setCargoCategory] = useState('general');
  const [includeInsurance, setIncludeInsurance] = useState(false);
  const [fobValue, setFobValue] = useState('');
  const [inputMode, setInputMode] = useState('dimensions');
  const [weight, setWeight] = useState('');
  const [dimensions, setDimensions] = useState({ length: '', width: '', height: '' });
  const [cbm, setCbm] = useState('');
  const [result, setResult] = useState(null);
  const MIN_CBM = 0.13;
  const DENSITY_LIMIT_KG_PER_CBM = 499;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const [configs, pricing, allStates] = await Promise.all([
      base44.entities.AppConfig.filter({ config_key: 'main' }),
      base44.entities.PricingConfig.filter({ config_key: 'main' }),
      base44.entities.StateConfig.filter({ is_active: true })
    ]);

    if (configs.length > 0) {
      setConfig(configs[0]);
      if (defaultShippingType === 'maritimo' && configs[0].shipping_type_sea_enabled !== false) {
        setShippingType('maritimo');
      } else if (defaultShippingType === 'aereo' && configs[0].shipping_type_air_enabled !== false) {
        setShippingType('aereo');
      } else if (configs[0].shipping_type_air_enabled !== false) {
        setShippingType('aereo');
      } else if (configs[0].shipping_type_sea_enabled !== false) {
        setShippingType('maritimo');
      }
    }

    if (pricing.length > 0) {
      setPricingConfig(pricing[0]);
    }

    if (allStates.length > 0) {
      const normalized = normalizeStates(allStates);
      setStates(normalized);
      let applied = false;
      if (user?.state) {
        const match = findStateByCodeOrName(normalized, user.state);
        if (match) {
          setSelectedState(match.state_code);
          applied = true;
        }
      }
      if (!applied && defaultStateCode) {
        const defMatch = findStateByCodeOrName(normalized, defaultStateCode);
        if (defMatch) {
          setSelectedState(defMatch.state_code);
          applied = true;
        }
      }
      if (!applied && normalized[0]?.state_code) {
        setSelectedState(normalized[0].state_code);
      }
    }

    setLoading(false);
  };

  const getFinalRatesForState = (stateShipping) => {
    const profit = (pricingConfig?.profit_percentage || 0) / 100;
    const door = pricingConfig?.door_to_door_cost || 0;
    const regular = (pricingConfig?.base_rate_regular || 0) * (1 + profit) + (stateShipping || 0) + door;
    const high = (pricingConfig?.base_rate_high_risk || 0) * (1 + profit) + (stateShipping || 0) + door;
    return { regular, high };
  };

  const calculateShipping = () => {
    if (!config || !selectedState) return;

    const realWeight = parseFloat(weight) || 0;
    let calculatedCbm = 0;
    let volumetricWeight = 0;

    if (inputMode === 'dimensions') {
      const l = parseFloat(dimensions.length) || 0;
      const w = parseFloat(dimensions.width) || 0;
      const h = parseFloat(dimensions.height) || 0;
      calculatedCbm = l && w && h ? (l * w * h) / 1000000 : 0;
      volumetricWeight = calculatedCbm * 167;
    } else if (inputMode === 'cbm') {
      calculatedCbm = parseFloat(cbm) || 0;
      volumetricWeight = calculatedCbm * 167;
    }

    const isSensitive = cargoCategory === 'sensitive';
    let billableWeight = 0;
    let chargedBy = '';
    let rateType = '';
    let densityKgPerCbm = 0;
    let maritimeMultiplier = 1;

    if (shippingType === 'aereo') {
      rateType = isSensitive ? 'Aéreo Sensible' : 'Aéreo General';
      billableWeight = Math.max(realWeight, volumetricWeight, 1);
      chargedBy = `${billableWeight.toFixed(2)} kg`;
    } else {
      rateType = isSensitive ? 'Marítimo Sensible' : 'Marítimo General';
      const usedCbm = calculatedCbm;
      densityKgPerCbm = usedCbm > 0 ? realWeight / usedCbm : 0;
      maritimeMultiplier = realWeight > DENSITY_LIMIT_KG_PER_CBM ? 2 : 1;
      billableWeight = usedCbm;
      chargedBy = `${usedCbm.toFixed(4)} CBM`;
    }

    const selectedStateConfig = findStateByCodeOrName(states, selectedState);
    const stateShipping = selectedStateConfig?.shipping_rate || 0;
    const { regular: finalRegular, high: finalHigh } = getFinalRatesForState(stateShipping);
    const baseRate = isSensitive ? finalHigh : finalRegular;

    let finalRate = shippingType === 'maritimo' ? baseRate * maritimeMultiplier : baseRate;
    let shippingCost = finalRate * billableWeight;
    let specialRateApplied = false;

    // Tarifa especial: cargas marítimas menores a 0.130 CBM (almacén Valencia + MRW cobro destino)
    if (shippingType === 'maritimo' && calculatedCbm > 0 && calculatedCbm < MIN_CBM) {
      const ranges = [...(config?.special_cbm_rates || [])].sort((a, b) => (a.min_cbm || 0) - (b.min_cbm || 0));
      const found = ranges.find(r => calculatedCbm <= (r.max_cbm || 0));
      if (found) {
        specialRateApplied = true;
        finalRate = isSensitive ? found.rate_high_risk : found.rate_regular;
        shippingCost = finalRate;
        chargedBy = `${calculatedCbm.toFixed(4)} CBM (tarifa fija por rango)`;
      }
    }

    const RECEPTION_FEE = 1;
    const fob = parseFloat(fobValue) || 0;
    const insuranceCost = includeInsurance && fob > 0 ? fob * (config?.insurance_percentage / 100) : 0;
    const totalCost = shippingCost + RECEPTION_FEE + insuranceCost;

    setResult({
    rateType,
    finalRate,
    volumetricWeight,
    cbm: calculatedCbm,
    billableWeight,
    chargedBy,
    shippingCost,
    receptionFee: RECEPTION_FEE,
    insuranceCost,
    totalCost,
    stateName: selectedStateConfig?.state_name || null,
    specialRateApplied,
    densityKgPerCbm,
    maritimeMultiplier
    });
  };

  useEffect(() => {
    calculateShipping();
  }, [shippingType, cargoCategory, includeInsurance, fobValue, inputMode, weight, dimensions.length, dimensions.width, dimensions.height, cbm, selectedState, pricingConfig, config, states]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <ClientPageHero
        icon={Calculator}
        eyebrow="Herramientas y consulta"
        title="Calculadora de Envíos"
        description="Calcula el costo estimado de tu envío de forma clara y rápida."
        badges={[shippingType === 'maritimo' ? 'Marítimo' : 'Aéreo', includeInsurance ? 'Con seguro' : 'Sin seguro']}
        aside={
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Resumen</p>
            <div className="rounded-2xl bg-slate-100/90 px-3 py-2 text-sm font-semibold text-slate-700">
              {result ? `$${result.totalCost.toFixed(2)}` : 'Sin cálculo'}
            </div>
            <p className="text-sm text-muted-foreground">Selecciona estado, tipo de envío y medidas para ver el estimado.</p>
          </div>
        }
      />

      <ClientSectionHeader
        title="Configura tu cálculo"
        description="Selecciona el destino y completa los datos para obtener una estimación inmediata."
      />

      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-[240px_1fr] items-center">
            <div className="text-sm text-slate-600">Estado de destino</div>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {states.map((state) => (
                  <SelectItem key={state.state_code} value={state.state_code}>{state.state_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedState ? (
        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Calculadora</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className={`grid ${config?.shipping_type_air_enabled !== false && config?.shipping_type_sea_enabled !== false ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
              {config?.shipping_type_air_enabled !== false && (
                <button
                  type="button"
                  onClick={() => setShippingType('aereo')}
                  className={`p-4 rounded-xl border-2 transition-all ${shippingType === 'aereo' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Plane className={`h-5 w-5 ${shippingType === 'aereo' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="font-semibold text-slate-800">Aéreo</span>
                  </div>
                  <p className="text-sm text-slate-500">15-20 días</p>
                </button>
              )}

              {config?.shipping_type_sea_enabled !== false && (
                <button
                  type="button"
                  onClick={() => setShippingType('maritimo')}
                  className={`p-4 rounded-xl border-2 transition-all ${shippingType === 'maritimo' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Ship className={`h-5 w-5 ${shippingType === 'maritimo' ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="font-semibold text-slate-800">Marítimo</span>
                  </div>
                  <p className="text-sm text-slate-500">75-90 días</p>
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Categoría de Carga</Label>
              <Select value={cargoCategory} onValueChange={setCargoCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="sensitive">Sensible</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
            <Label>Método de Cálculo</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInputMode('dimensions')}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${inputMode === 'dimensions' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
              >
                Por Dimensiones
              </button>
              <button
                type="button"
                onClick={() => setInputMode('cbm')}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${inputMode === 'cbm' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
              >
                Por CBM
              </button>
            </div>
            </div>

            {(shippingType === 'aereo' || shippingType === 'maritimo') && (
            <div className="space-y-2">
              <Label>Peso Real (kg)</Label>
              <Input type="number" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="1.0" />
            </div>
            )}

            {inputMode === 'cbm' && (
            <div className="space-y-2">
              <Label>CBM (Metros Cúbicos)</Label>
              <Input type="number" step="0.0001" value={cbm} onChange={(e) => setCbm(e.target.value)} placeholder="0.0000" />
            </div>
            )}

            {shippingType === 'aereo' ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-800 mb-1">Envío Aéreo</p>
                <p className="text-sm text-blue-700">Se calcula por peso real y por volumen, y se factura el mayor. Mínimo 1 kg.</p>
                <p className="text-xs text-blue-600 mt-2">Fórmula: CBM × 167 kg/m³</p>
              </div>
            ) : (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-indigo-800 mb-1">Envío Marítimo</p>
                <p className="text-sm text-indigo-700">Se calcula por volumen en CBM y también puedes validar el peso de la carga.</p>
                <p className="text-xs text-indigo-600">Fórmula: (L × A × H) / 1,000,000</p>
                <div className="rounded-lg bg-white/70 border border-indigo-200 px-3 py-2 text-sm text-indigo-800">
                  La carga cubre hasta 499 kg. Desde 500 kg en adelante, se factura x2 el costo del envío.
                </div>
              </div>
            )}

            {inputMode === 'dimensions' && (
              <div className="space-y-2">
                <Label>Dimensiones (cm)</Label>
                <div className="grid grid-cols-3 gap-3">
                  <Input type="number" placeholder="Largo" value={dimensions.length} onChange={(e) => setDimensions({ ...dimensions, length: e.target.value })} />
                  <Input type="number" placeholder="Ancho" value={dimensions.width} onChange={(e) => setDimensions({ ...dimensions, width: e.target.value })} />
                  <Input type="number" placeholder="Alto" value={dimensions.height} onChange={(e) => setDimensions({ ...dimensions, height: e.target.value })} />
                </div>
              </div>
            )}

            <div className="flex items-start space-x-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <Checkbox id="insurance" checked={includeInsurance} onCheckedChange={setIncludeInsurance} />
              <div className="flex-1 space-y-3">
                <div>
                  <label htmlFor="insurance" className="font-medium text-slate-800 cursor-pointer">
                    Asegurar Carga ({config?.insurance_percentage || 5}% del valor FOB)
                  </label>
                  <p className="text-sm text-slate-500">Protege tu envío contra daños o pérdidas</p>
                </div>
                {includeInsurance && (
                  <div className="space-y-2">
                    <Label>Valor FOB (USD)</Label>
                    <Input type="number" step="0.01" value={fobValue} onChange={(e) => setFobValue(e.target.value)} placeholder="0.00" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="p-4 text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-lg">
          Selecciona un estado para continuar con la calculadora.
        </div>
      )}

      {selectedState && result && (
        <div className="space-y-4">
          <ClientSectionHeader
            title="Resultado estimado"
            description="Revisa el detalle del cálculo, la unidad facturable y el total aproximado."
          />
          {shippingType === 'maritimo' && result.maritimeMultiplier === 2 && (
            <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
              <p className="font-semibold text-red-700">⚠️ SOBREPESO DETECTADO</p>
              <p className="mt-1 text-sm text-red-700">El peso real de tu carga ({parseFloat(weight).toFixed(2)} kg) supera los 499 kg permitidos. Por este motivo, el costo del envío se multiplica por 2.</p>
            </div>
          )}
          <Card className="border-border/70 bg-gradient-to-br from-slate-50 to-white shadow-card">
            <CardHeader>
              <CardTitle>Detalles del Envío</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-white p-4">
                  <p className="text-sm font-medium text-slate-700">Tarifa aplicada</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">${result.finalRate.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{result.specialRateApplied ? `${result.rateType} — Tarifa fija por rango` : `${result.rateType} / ${shippingType === 'aereo' ? 'kg' : 'CBM'}`}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-white p-4">
                  <p className="text-sm font-medium text-slate-700">Unidad facturable</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{result.chargedBy}</p>
                  <p className="text-xs text-slate-500">Base del cálculo</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-white p-4">
                  <p className="text-sm font-medium text-slate-700">Costo de envío</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">${result.shippingCost.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{result.specialRateApplied ? 'Tarifa fija según rango de CBM' : `${result.finalRate.toFixed(2)} × ${result.billableWeight.toFixed(shippingType === 'aereo' ? 2 : 4)}`}</p>
                </div>
                {includeInsurance && (parseFloat(fobValue) || 0) > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-800">Total estimado</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-700">${result.totalCost.toFixed(2)}</p>
                    <p className="text-xs text-emerald-700">Incluye seguro si fue seleccionado</p>
                  </div>
                )}
              </div>

              {result.insuranceCost > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-800">Seguro</p>
                  <p className="mt-1 text-xl font-bold text-amber-700">${result.insuranceCost.toFixed(2)}</p>
                  <p className="text-xs text-amber-700">{(config?.insurance_percentage || 0)}% del valor FOB</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-2">
                <div className="rounded-lg bg-slate-100/80 px-3 py-2">Peso volumétrico: {result.volumetricWeight.toFixed(2)} kg</div>
                <div className="rounded-lg bg-slate-100/80 px-3 py-2">CBM calculado: {result.cbm.toFixed(4)}</div>
                <div className="rounded-lg bg-slate-100/80 px-3 py-2 md:col-span-2">Cargo por recepción de paquete: ${result.receptionFee.toFixed(2)}</div>
                {shippingType === 'maritimo' && result.specialRateApplied && (
                  <div className="rounded-lg bg-sky-50 px-3 py-2 text-sky-700 md:col-span-2">
                    Carga menor a 0.130 CBM: aplica tarifa fija por rango. Tu carga llega a nuestro almacén en Valencia y el despacho final es vía MRW cobro destino (costo de MRW no incluido).
                  </div>
                )}
                {shippingType === 'maritimo' && result.densityKgPerCbm > 0 && (
                  <div className="rounded-lg bg-indigo-50 px-3 py-2 text-indigo-700 md:col-span-2">
                    {result.maritimeMultiplier === 2 ? 'Sobrepeso: el peso real supera los 499 kg, se aplica x2 al costo del envío.' : 'El cobro x2 se aplica cuando el peso real supera los 499 kg.'}
                  </div>
                )}
                {result.stateName && (
                  <div className="rounded-lg bg-slate-100/80 px-3 py-2 md:col-span-2">Estado: {result.stateName}</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}