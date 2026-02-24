import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Loader2,
  Plane,
  Ship,
  Package,
  ShieldCheck,
  DollarSign,
  Calculator
} from 'lucide-react';

export default function Rates({ user }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stateConfig, setStateConfig] = useState(null);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [shippingType, setShippingType] = useState('');
  const [cargoCategory, setCargoCategory] = useState('general');
  const [includeInsurance, setIncludeInsurance] = useState(false);
  const [fobValue, setFobValue] = useState('');
  const [inputMode, setInputMode] = useState('dimensions');
  const [weight, setWeight] = useState('');
  const [dimensions, setDimensions] = useState({ length: '', width: '', height: '' });
  const [cbm, setCbm] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const [configs, pricing, states] = await Promise.all([
      base44.entities.AppConfig.filter({ config_key: 'main' }),
      base44.entities.PricingConfig.filter({ config_key: 'main' }),
      user?.state ? base44.entities.StateConfig.filter({ state_code: user.state }) : Promise.resolve([])
    ]);
    
    if (configs.length > 0) {
      setConfig(configs[0]);
      // Set default shipping type to first enabled option
      if (configs[0].shipping_type_air_enabled !== false) {
        setShippingType('aereo');
      } else if (configs[0].shipping_type_sea_enabled !== false) {
        setShippingType('maritimo');
      }
    }
    
    if (pricing.length > 0) {
      setPricingConfig(pricing[0]);
    }
    
    if (states.length > 0) {
      setStateConfig(states[0]);
    }
    
    setLoading(false);
  };

  const calculateShipping = () => {
    if (!config) return;

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
    let rate = 0;
    let billableWeight = 0;
    let baseCost = 0;
    let chargedBy = '';
    let rateType = '';

    if (shippingType === 'aereo') {
      rate = isSensitive ? (config.rate_air_sensitive || 0) : (config.rate_air_general || 0);
      rateType = isSensitive ? 'Aéreo Sensible' : 'Aéreo General';
      billableWeight = Math.max(realWeight, volumetricWeight, 1);
      baseCost = billableWeight * rate;
      chargedBy = `${billableWeight.toFixed(2)} kg`;
    } else {
      rate = isSensitive ? (config.rate_sea_sensitive || 0) : (config.rate_sea_general || 0);
      rateType = isSensitive ? 'Marítimo Sensible' : 'Marítimo General';
      baseCost = calculatedCbm * rate;
      billableWeight = calculatedCbm;
      chargedBy = `${calculatedCbm.toFixed(4)} CBM`;
    }

    const fob = parseFloat(fobValue) || 0;
    const insuranceCost = includeInsurance && fob > 0 ? fob * (config.insurance_percentage / 100) : 0;
    const totalCost = baseCost + insuranceCost;

    setResult({
      rate,
      rateType,
      volumetricWeight,
      cbm: calculatedCbm,
      billableWeight,
      chargedBy,
      baseCost,
      insuranceCost,
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Tarifas de Envío</h1>
        <p className="text-slate-500">Conoce nuestras tarifas competitivas para tu carga</p>
      </div>

      {/* Shipping Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Air Shipping */}
        {config?.shipping_type_air_enabled !== false && (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Plane className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Envío Aéreo</CardTitle>
                <CardDescription>Rápido y seguro</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-white rounded-xl border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-600">Carga General</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">
                    {stateConfig && pricingConfig ? (
                      `$${(pricingConfig.base_rate_regular * (1 + pricingConfig.profit_percentage / 100) + stateConfig.shipping_rate + (pricingConfig.is_door_to_door_optional ? 0 : pricingConfig.door_to_door_cost)).toFixed(2)}`
                    ) : (
                      `$${config?.rate_air_general?.toFixed(2) || '0.00'}`
                    )}
                  </p>
                  <p className="text-xs text-slate-500">por kilogramo</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Ideal para productos estándar: ropa, electrónicos, accesorios, etc.
              </p>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Carga Sensible</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-600">
                    {stateConfig && pricingConfig ? (
                      `$${(pricingConfig.base_rate_high_risk * (1 + pricingConfig.profit_percentage / 100) + stateConfig.shipping_rate + (pricingConfig.is_door_to_door_optional ? 0 : pricingConfig.door_to_door_cost)).toFixed(2)}`
                    ) : (
                      `$${config?.rate_air_sensitive?.toFixed(2) || '0.00'}`
                    )}
                  </p>
                  <p className="text-xs text-slate-500">por kilogramo</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Para artículos frágiles o de alto valor: perfumes, vidrio, joyería, etc.
              </p>
            </div>

            <div className="mt-4 p-3 bg-blue-50/50 rounded-lg">
              <p className="text-xs text-slate-600">
                ⏱️ <span className="font-medium">Tiempo estimado:</span> 7-15 días
              </p>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Sea Shipping */}
        {config?.shipping_type_sea_enabled !== false && (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Ship className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Envío Marítimo</CardTitle>
                <CardDescription>Económico y confiable</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-white rounded-xl border border-indigo-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-600">Carga General</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-600">
                    {stateConfig && pricingConfig ? (
                      `$${(pricingConfig.base_rate_regular * (1 + pricingConfig.profit_percentage / 100) + stateConfig.shipping_rate + (pricingConfig.is_door_to_door_optional ? 0 : pricingConfig.door_to_door_cost)).toFixed(2)}`
                    ) : (
                      `$${config?.rate_sea_general?.toFixed(2) || '0.00'}`
                    )}
                  </p>
                  <p className="text-xs text-slate-500">por CBM</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Para grandes volúmenes: muebles, electrodomésticos, cajas múltiples.
              </p>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Carga Sensible</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-600">
                    {stateConfig && pricingConfig ? (
                      `$${(pricingConfig.base_rate_high_risk * (1 + pricingConfig.profit_percentage / 100) + stateConfig.shipping_rate + (pricingConfig.is_door_to_door_optional ? 0 : pricingConfig.door_to_door_cost)).toFixed(2)}`
                    ) : (
                      `$${config?.rate_sea_sensitive?.toFixed(2) || '0.00'}`
                    )}
                  </p>
                  <p className="text-xs text-slate-500">por CBM</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Carga frágil de gran volumen con manejo especial y cuidadoso.
              </p>
            </div>

            <div className="mt-4 p-3 bg-indigo-50/50 rounded-lg">
              <p className="text-xs text-slate-600">
                ⏱️ <span className="font-medium">Tiempo estimado:</span> 45-60 días
              </p>
            </div>
          </CardContent>
        </Card>
        )}
      </div>

      {/* Insurance */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-50 to-teal-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Seguro de Carga</CardTitle>
              <CardDescription>Protege tu inversión</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-6 bg-white rounded-xl border border-emerald-100">
            <div>
              <p className="text-sm text-slate-600 mb-1">Cobertura completa sobre el valor FOB</p>
              <p className="text-xs text-slate-500">
                Protección contra daños, pérdidas o robos durante el transporte
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-emerald-600">
                {config?.insurance_percentage || 5}%
              </p>
              <p className="text-xs text-slate-500">del valor FOB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sensitive Cargo Info */}
      <Card className="border-0 shadow-lg border-l-4 border-l-amber-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            ¿Qué se considera carga sensible?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              <span>Baterías de litio</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              <span>Alimentos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              <span>Cosméticos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              <span>Agentes acuosos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              <span>Réplicas o imitaciones</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              <span>Polvos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              <span>Marcas chinas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              <span>Mercancía de alto valor</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prohibited Items */}
      <Card className="border-0 shadow-lg border-l-4 border-l-red-500 bg-red-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            🚫 No enviamos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-700">
            Medicamentos, armas, pólvora, gas, motos, chalecos, fundas tácticas, botellas presurizadas, entre otros
          </p>
        </CardContent>
      </Card>

      {/* Payment Info */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-l-emerald-500">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-full">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-lg">Pago contra entrega</h3>
              <p className="text-sm text-slate-600">Pagas tu envío al momento de recibir tu mercancía</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Info */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Información Adicional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex gap-2">
              <span className="font-semibold min-w-[140px]">Peso Volumétrico:</span>
              <span>Para envíos aéreos se calcula como CBM × 167 kg/m³</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold min-w-[140px]">CBM:</span>
              <span>Para envíos marítimos se calcula como (Largo × Ancho × Alto en metros)</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold min-w-[140px]">Costo Final:</span>
              <span>Se cobra según el peso facturable (el mayor entre peso real y volumétrico)</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold min-w-[140px]">Carga Sensible:</span>
              <span>Incluye manejo especial, empaque reforzado y seguimiento prioritario</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculator */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            Calculadora de Envíos
          </CardTitle>
          <CardDescription>Calcula el costo estimado de tu envío</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Shipping Type */}
          <div className={`grid ${config?.shipping_type_air_enabled !== false && config?.shipping_type_sea_enabled !== false ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            {config?.shipping_type_air_enabled !== false && (
              <button
                type="button"
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
                type="button"
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
              <span className="text-slate-600">Tarifa por {shippingType === 'aereo' ? 'kg' : 'CBM'}:</span>
              <div className="text-right">
                <span className="font-semibold">${result.rate.toFixed(2)}/{shippingType === 'aereo' ? 'kg' : 'CBM'}</span>
                <p className="text-xs text-slate-500">{result.rateType}</p>
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

            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">Se cobra por:</span>
              <span className="font-semibold text-sm">{result.chargedBy}</span>
            </div>

            <div className="flex justify-between py-2 border-b">
              <span className="text-slate-600">Costo base:</span>
              <span className="font-semibold">${result.baseCost.toFixed(2)}</span>
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

      {/* CTA */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <CardContent className="p-8 text-center">
          <h3 className="text-2xl font-bold mb-2">¿Listo para enviar?</h3>
          <p className="text-blue-100 mb-4">
            Crea una pre-alerta y comienza a enviar tus productos de forma segura
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span>100% Seguro</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span>Seguimiento en tiempo real</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span>Precios competitivos</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}