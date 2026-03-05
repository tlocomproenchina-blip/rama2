import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Plane, Ship, Package, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeStates, findStateByCodeOrName } from '@/components/utils/states';

export default function ShippingCalculator({ user }) {
  const [config, setConfig] = useState(null);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [loading, setLoading] = useState(true);
  const [shippingType, setShippingType] = useState('aereo');
  const [cargoCategory, setCargoCategory] = useState('general');
  const [includeInsurance, setIncludeInsurance] = useState(false);
  const [fobValue, setFobValue] = useState('');
  const [inputMode, setInputMode] = useState('dimensions'); // 'dimensions' | 'cbm'
  const [weight, setWeight] = useState('');
  const [dimensions, setDimensions] = useState({ length: '', width: '', height: '' });
  const [cbm, setCbm] = useState('');
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(1);
  const MIN_CBM = 0.13;

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
      // Set default to first enabled option
      if (configs[0].shipping_type_air_enabled !== false) {
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
      // Set default state from user if available (accepts code or name)
      if (user?.state) {
        const match = findStateByCodeOrName(normalized, user.state);
        if (match) setSelectedState(match.state_code);
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
    if (!config) return;

    const realWeight = parseFloat(weight) || 0;
    let calculatedCbm = 0;
    let volumetricWeight = 0;

    // Calculate based on input mode
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

    // Determine rate based on pricing config
    const isSensitive = cargoCategory === 'sensitive';
    let baseRate = 0;
    let billableWeight = 0;
    let baseCost = 0;
    let chargedBy = '';
    let rateType = '';

    if (shippingType === 'aereo') {
      baseRate = isSensitive ? (pricingConfig?.base_rate_high_risk || 0) : (pricingConfig?.base_rate_regular || 0);
      rateType = isSensitive ? 'Aéreo Sensible' : 'Aéreo General';
      // For air: charge by the greater of real or volumetric weight, minimum 1 kg
      billableWeight = Math.max(realWeight, volumetricWeight, 1);
      baseCost = billableWeight * baseRate;
      chargedBy = `${billableWeight.toFixed(2)} kg`;
    } else {
      baseRate = isSensitive ? (pricingConfig?.base_rate_high_risk || 0) : (pricingConfig?.base_rate_regular || 0);
      rateType = isSensitive ? 'Marítimo Sensible' : 'Marítimo General';
      // For sea: charge by CBM with minimum billable volume
      const usedCbm = Math.max(calculatedCbm, MIN_CBM);
      baseCost = usedCbm * baseRate;
      billableWeight = usedCbm;
      chargedBy = `${usedCbm.toFixed(4)} CBM${usedCbm > calculatedCbm ? ' (mínimo facturable)' : ''}`;
    }

    // Determinar estado y tasas finales (Regular/Alto) desde la sección de Estados
    const selectedStateConfig = findStateByCodeOrName(states, selectedState);
    const stateShipping = selectedStateConfig?.shipping_rate || 0;
    const { regular: finalRegular, high: finalHigh } = getFinalRatesForState(stateShipping);
    const doorToDoor = pricingConfig?.door_to_door_cost || 0;

    // Elegir el precio final según la categoría de carga
    const finalRate = isSensitive ? finalHigh : finalRegular;

    // Total de Envío = Precio Final × CBM (o peso facturable para aéreo)
    const shippingCost = finalRate * billableWeight;

    // Calculate insurance
    const fob = parseFloat(fobValue) || 0;
    const insuranceCost = includeInsurance && fob > 0 ? fob * (config?.insurance_percentage / 100) : 0;

    const totalCost = shippingCost + insuranceCost;

    setResult({
      baseRate,
      rateType,
      finalRate,
      volumetricWeight,
      cbm: calculatedCbm,
      billableWeight,
      chargedBy,
      baseCost,
      shippingCost,
      insuranceCost,
      stateShipping,
      doorToDoor,
      stateName: selectedStateConfig?.state_name || null,
      totalCost,
      minCbmApplied: shippingType === 'maritimo' && calculatedCbm < MIN_CBM,
      minCbm: MIN_CBM
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Calculator className="h-6 w-6 text-blue-600" />
          Calculadora de Envíos
        </h1>
        <p className="text-slate-500">Calcula el costo estimado de tu envío</p>
        </div>

        {/* Estado de destino (fijo) */}
        <Card className="border-0 shadow bg-white">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-[240px_1fr] items-center">
            <div className="text-sm text-slate-600">Estado de destino</div>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {states.map((s) => (
                  <SelectItem key={s.state_code} value={s.state_code}>{s.state_name}</SelectItem>
                )})}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Calculadora</CardTitle>
            <div className="flex gap-2">
              <div className={`px-2.5 py-1 rounded-full text-xs ${step===1?'bg-blue-600 text-white':'bg-slate-100 text-slate-600'}`}>1. Datos</div>
              <div className={`px-2.5 py-1 rounded-full text-xs ${step===2?'bg-blue-600 text-white':'bg-slate-100 text-slate-600'}`}>2. Opciones</div>
              <div className={`px-2.5 py-1 rounded-full text-xs ${step===3?'bg-blue-600 text-white':'bg-slate-100 text-slate-600'}`}>3. Resultado</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Shipping Type */}
          {step === 2 && (
          <div className={`grid ${config?.shipping_type_air_enabled !== false && config?.shipping_type_sea_enabled !== false ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            {config?.shipping_type_air_enabled !== false && (
              <button
                onClick={() => setShippingType('aereo')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  shippingType === 'aereo'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
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
                onClick={() => setShippingType('maritimo')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  shippingType === 'maritimo'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Ship className={`h-5 w-5 ${shippingType === 'maritimo' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="font-semibold text-slate-800">Marítimo</span>
                </div>
                <p className="text-sm text-slate-500">75-90 días</p>
              </button>
            )}
          </div>
          )}

            {/* Cargo Category */}
          {step === 2 && (
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
          )}

            {/* Input Mode Selection */}
          {step === 1 && (
          <div className="space-y-2">
            <Label>Método de Cálculo</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInputMode('dimensions')}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  inputMode === 'dimensions'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                Por Dimensiones
              </button>
              <button
                type="button"
                onClick={() => setInputMode('cbm')}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  inputMode === 'cbm'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                Por CBM
              </button>
            </div>
          </div>

          {/* Weight Input - Always visible */}
          <div className="space-y-2">
            <Label>Peso Real (kg)</Label>
            <Input
              type="number"
              step="0.01"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="1.0"
            />
          </div>

          {/* CBM Input */}
          {inputMode === 'cbm' && (
            <div className="space-y-2">
              <Label>CBM (Metros Cúbicos)</Label>
              <Input
                type="number"
                step="0.0001"
                value={cbm}
                onChange={(e) => setCbm(e.target.value)}
                placeholder="0.0000"
              />
            </div>
          )}

          {/* Info Box */}
          {shippingType === 'aereo' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-800 mb-1">📦 Envío Aéreo</p>
              <p className="text-sm text-blue-700">
                Se calcula por <strong>peso real</strong> y por <strong>volumen</strong>, y se factura el <strong>que sea mayor</strong>. Mínimo 1 kg.
              </p>
              <p className="text-xs text-blue-600 mt-2">
                Fórmula de <strong>peso volumétrico</strong>: CBM × 167 kg/m³
              </p>
            </div>
          ) : (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="text-sm font-medium text-indigo-800 mb-1">🚢 Envío Marítimo</p>
              <p className="text-sm text-indigo-700">
                Se calcula por <strong>volumen en CBM</strong> (metros cúbicos).
              </p>
              <p className="text-xs text-indigo-600 mt-2">
                Fórmula de <strong>CBM</strong>: (L × A × H) / 1,000,000
              </p>
            </div>
          )}

          {/* Dimensions */}
          {inputMode === 'dimensions' && (
            <div className="space-y-2">
              <Label>Dimensiones (cm)</Label>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  type="number"
                  placeholder="Largo"
                  value={dimensions.length}
                  onChange={(e) => setDimensions({ ...dimensions, length: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Ancho"
                  value={dimensions.width}
                  onChange={(e) => setDimensions({ ...dimensions, width: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Alto"
                  value={dimensions.height}
                  onChange={(e) => setDimensions({ ...dimensions, height: e.target.value })}
                />
              </div>
            </div>
          )}

           )}

            {/* Insurance */}
          {step === 2 && (
          <div className="flex items-start space-x-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <Checkbox
              id="insurance"
              checked={includeInsurance}
              onCheckedChange={setIncludeInsurance}
            />
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
                  <Input
                    type="number"
                    step="0.01"
                    value={fobValue}
                    onChange={(e) => setFobValue(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>
          </div>
          )}

            {/* Calculate Button */}
          <div className="flex justify-between gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>Atrás</Button>
            )}
            {step === 1 && (
              <Button onClick={() => setStep(2)} className="ml-auto">Siguiente</Button>
            )}
            {step === 2 && (
              <Button onClick={() => { calculateShipping(); setStep(3); }} className="ml-auto bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white">
                Calcular y ver resultado
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {step === 3 && result && (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white">
          <CardHeader>
            <CardTitle>Detalles del Envío</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Cálculo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Tarifa aplicada</TableCell>
                    <TableCell>{result.rateType}</TableCell>
                    <TableCell className="text-right">${result.finalRate.toFixed(2)}/{shippingType === 'aereo' ? 'kg' : 'CBM'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Unidad facturable</TableCell>
                    <TableCell>{result.chargedBy}</TableCell>
                    <TableCell className="text-right">—</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Costo de envío</TableCell>
                    <TableCell>{result.finalRate.toFixed(2)} × {result.billableWeight.toFixed( shippingType === 'aereo' ? 2 : 4 )}</TableCell>
                    <TableCell className="text-right">${result.shippingCost.toFixed(2)}</TableCell>
                  </TableRow>
                  {result.insuranceCost > 0 && (
                    <TableRow>
                      <TableCell className="font-medium">Seguro</TableCell>
                      <TableCell>{(config?.insurance_percentage || 0)}% de FOB</TableCell>
                      <TableCell className="text-right">${result.insuranceCost.toFixed(2)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">${result.totalCost.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div>Peso volumétrico: {result.volumetricWeight.toFixed(2)} kg</div>
              <div>CBM calculado: {result.cbm.toFixed(4)}</div>
              {shippingType === 'maritimo' && result.minCbmApplied && (
                <div className="col-span-2 text-amber-700">Se aplicó mínimo facturable de {result.minCbm.toFixed(4)} CBM</div>
              )}
              {result.stateName && (<div className="col-span-2">Estado: {result.stateName}</div>)}
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep(2)}>Editar opciones</Button>
              <Button onClick={() => setStep(1)} variant="ghost">Nuevo cálculo</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}