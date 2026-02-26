import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Plane, Ship, Package, Loader2 } from 'lucide-react';

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
      setStates(allStates);
      // Set default state from user if available
      if (user?.state) {
        setSelectedState(user.state);
      }
    }
    
    setLoading(false);
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
      // For sea: charge by CBM
      baseCost = calculatedCbm * baseRate;
      billableWeight = calculatedCbm;
      chargedBy = `${calculatedCbm.toFixed(4)} CBM`;
    }

    // Apply profit percentage to base rate
    const profitMargin = pricingConfig?.profit_percentage || 0;
    const adjustedRate = baseRate * (1 + profitMargin / 100);

    // Add state shipping cost and door to door to create final rate
    const selectedStateConfig = states.find(s => s.state_code === selectedState);
    const stateShipping = selectedStateConfig?.shipping_rate || 0;
    const doorToDoor = pricingConfig?.door_to_door_cost || 0;

    // Precio Final = Tarifa Base × (1 + % Beneficio/100) + Tarifa Estado + Puerta a Puerta
    const finalRate = adjustedRate + stateShipping + doorToDoor;

    // Total de Envío = Precio Final × unidades (kg para aéreo o CBM para marítimo)
    const units = shippingType === 'aereo' ? billableWeight : calculatedCbm;
    const shippingCost = finalRate * units;

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
      totalCost
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

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Tipo de Envío</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Shipping Type */}
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

          {/* Cargo Category */}
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

          {/* State Selection */}
          <div className="space-y-2">
            <Label>Estado de Destino</Label>
            {user?.role === 'admin' ? (
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  {states.map((state) => (
                    <SelectItem key={state.state_code} value={state.state_code}>
                      {state.state_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={states.find(s => s.state_code === selectedState)?.state_name || 'No configurado'}
                disabled
                className="bg-slate-50"
              />
            )}
          </div>

          {/* Input Mode Selection */}
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

          {/* Insurance */}
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

          {/* Calculate Button */}
          <Button
            onClick={calculateShipping}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white py-6 text-lg"
          >
            Calcular Envío
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white">
          <CardHeader>
            <CardTitle>Detalles del Envío</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">Tarifa final:</span>
              <div className="text-right">
                <span className="font-semibold">${result.finalRate.toFixed(2)}/{shippingType === 'aereo' ? 'kg' : 'CBM'}</span>
                <p className="text-xs text-slate-500">{cargoCategory === 'sensitive' ? 'Precio final alto riesgo' : 'Precio final regular'}</p>
              </div>
            </div>

            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">Peso volumétrico:</span>
              <span className="font-semibold">{result.volumetricWeight.toFixed(2)} kg</span>
            </div>

            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">CBM calculado:</span>
              <span className="font-semibold">{result.cbm.toFixed(4)}</span>
            </div>

            {result.insuranceCost > 0 && (
              <div className="flex justify-between py-2 border-b">
                <span className="text-slate-600">Seguro:</span>
                <span className="font-semibold">${result.insuranceCost.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between py-3 bg-emerald-50 rounded-lg px-4 mt-4">
              <span className="text-lg font-bold text-slate-800">Total envío:</span>
              <span className="text-2xl font-bold text-emerald-600">${result.totalCost.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}