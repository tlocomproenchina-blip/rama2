import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useEnabledShippingTypes } from '@/components/ShippingTypeFilter';
import { 
  CheckCircle2, 
  Search, 
  Loader2,
  Package,
  User,
  Layers,
  Plane,
  Ship,
  Download,
  Weight,
  Ruler,
  DollarSign,
  Calendar,
  Box,
  Plus,
  ArrowLeft,
  Shield,
  Undo
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';

export default function AdminShipmentApprovals({ user }) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [allPackages, setAllPackages] = useState([]);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [config, setConfig] = useState(null);
  const enabledTypes = useEnabledShippingTypes();
  const [consolidationData, setConsolidationData] = useState({
    real_weight_kg: '',
    length_cm: '',
    width_cm: '',
    height_cm: '',
    estimated_delivery: ''
  });
  const [processing, setProcessing] = useState(false);
  const [inputMode, setInputMode] = useState('dimensions');
  const [directCbm, setDirectCbm] = useState('');
  const [selectedShippingType, setSelectedShippingType] = useState('aereo');
  const [hasInsurance, setHasInsurance] = useState(false);
  const [customFobValue, setCustomFobValue] = useState('');
  const [undoTracking, setUndoTracking] = useState('');
  const [undoing, setUndoing] = useState(false);
  const [clientUser, setClientUser] = useState(null);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [stateConfig, setStateConfig] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [reqs, configs, pricing] = await Promise.all([
      base44.entities.ConsolidationRequest.filter({ status: 'aprobada' }, '-created_date'),
      base44.entities.AppConfig.filter({ config_key: 'main' }),
      base44.entities.PricingConfig.filter({ config_key: 'main' })
    ]);
    
    setRequests(reqs);
    if (configs.length > 0) setConfig(configs[0]);
    if (pricing.length > 0) setPricingConfig(pricing[0]);
    setLoading(false);
  };

  const selectRequest = async (request) => {
    setSelectedRequest(request);
    setSelectedPackages(request.package_ids || []);
    setSelectedShippingType(request.shipping_type || 'aereo');
    
    const [pkgs, users, states] = await Promise.all([
      base44.entities.Package.filter({ 
        client_email: request.client_email,
        status: 'recibido'
      }),
      base44.entities.User.list(),
      base44.entities.StateConfig.list()
    ]);
    
    const filteredPkgs = pkgs.filter(p => !p.consolidation_id);
    setAllPackages(filteredPkgs);
    
    // Get client user data for state
    const client = users.find(u => u.email === request.client_email);
    setClientUser(client);
    
    // Get state config for shipping rate
    if (client?.state) {
      const state = states.find(s => 
        s.state_code === client.state || 
        s.state_name.toLowerCase() === client.state.toLowerCase()
      );
      setStateConfig(state);
    }
    
    // Check if any of the selected packages has insurance
    const selectedPkgs = filteredPkgs.filter(p => request.package_ids?.includes(p.id));
    const pkgsWithInsurance = selectedPkgs.some(p => p.has_insurance);
    setHasInsurance(pkgsWithInsurance);
    
    // Calculate total FOB from selected packages
    const totalFOB = selectedPkgs.reduce((sum, p) => sum + (p.has_insurance ? (p.fob_value || 0) : 0), 0);
    setCustomFobValue(totalFOB.toString());
  };

  const togglePackage = (pkgId) => {
    setSelectedPackages(prev => 
      prev.includes(pkgId) 
        ? prev.filter(id => id !== pkgId)
        : [...prev, pkgId]
    );
  };

  const calculateValues = () => {
    const { length_cm, width_cm, height_cm, real_weight_kg } = consolidationData;
    const realWeight = parseFloat(real_weight_kg) || 0;

    let cbm, volumetricWeight;
    
    if (inputMode === 'cbm') {
      cbm = parseFloat(directCbm) || 0;
      volumetricWeight = cbm * 167;
    } else {
      const l = parseFloat(length_cm) || 0;
      const w = parseFloat(width_cm) || 0;
      const h = parseFloat(height_cm) || 0;
      cbm = (l * w * h) / 1000000;
      volumetricWeight = cbm * 167;
    }

    const billableWeight = Math.max(realWeight, volumetricWeight);

    const totalFOB = hasInsurance ? (parseFloat(customFobValue) || 0) : 0;
    const insuranceCost = totalFOB * ((config?.insurance_percentage || 5) / 100);

    // Calculate base shipping cost (Tarifa Base)
    let baseRate = 0;
    if (selectedShippingType === 'aereo') {
      baseRate = hasInsurance ? (pricingConfig?.base_rate_high_risk || 790) : (pricingConfig?.base_rate_regular || 690);
    } else {
      baseRate = hasInsurance ? (pricingConfig?.base_rate_high_risk || 790) : (pricingConfig?.base_rate_regular || 690);
    }
    
    // Apply profit percentage (Beneficio)
    const profitPercentage = pricingConfig?.profit_percentage || 10;
    const baseWithProfit = baseRate * (1 + profitPercentage / 100);
    
    // Calculate shipping cost based on billable weight/CBM
    let shippingCost = 0;
    if (selectedShippingType === 'aereo') {
      shippingCost = billableWeight * baseWithProfit;
    } else {
      shippingCost = cbm * baseWithProfit;
    }
    
    // Add state shipping rate (Tarifa Estado)
    const stateShippingRate = stateConfig?.shipping_rate || 0;
    
    // Add door-to-door if applicable (Puerta a Puerta)
    const doorToDoorCost = pricingConfig?.is_door_to_door_optional 
      ? (pricingConfig?.door_to_door_cost || 0)
      : 0;
    
    // Formula: Precio Final = Tarifa Base × (1 + % Beneficio/100) + Tarifa Estado + Puerta a Puerta
    const totalCost = shippingCost + stateShippingRate + doorToDoorCost + insuranceCost;

    return {
      cbm,
      volumetricWeight,
      billableWeight,
      baseRate,
      profitPercentage,
      shippingCost,
      stateShippingRate,
      doorToDoorCost,
      insuranceCost,
      totalCost
    };
  };

  const handleConsolidate = async () => {
    if (selectedPackages.length === 0) {
      toast.error('Selecciona al menos un paquete');
      return;
    }

    setProcessing(true);
    try {
      const calcs = calculateValues();
      const selectedPkgs = allPackages.filter(p => selectedPackages.includes(p.id));
      const trackingNumbers = selectedPkgs.map(p => p.tracking_number);
      
      const date = new Date();
      const dateStr = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const consolidationTracking = `CON-${selectedRequest.shipping_mark || 'TLEC'}-${random}-${dateStr}`;

      const consolidation = await base44.entities.Consolidation.create({
        consolidation_tracking: consolidationTracking,
        client_email: selectedRequest.client_email,
        shipping_mark: selectedRequest.shipping_mark,
        package_ids: selectedPackages,
        tracking_numbers: trackingNumbers,
        shipping_type: selectedShippingType,
        real_weight_kg: parseFloat(consolidationData.real_weight_kg),
        length_cm: inputMode === 'dimensions' ? parseFloat(consolidationData.length_cm) : 0,
        width_cm: inputMode === 'dimensions' ? parseFloat(consolidationData.width_cm) : 0,
        height_cm: inputMode === 'dimensions' ? parseFloat(consolidationData.height_cm) : 0,
        cbm: calcs.cbm,
        volumetric_weight: calcs.volumetricWeight,
        billable_weight: calcs.billableWeight,
        shipping_cost: calcs.shippingCost,
        insurance_cost: calcs.insuranceCost,
        total_cost: calcs.totalCost,
        estimated_delivery: consolidationData.estimated_delivery,
        consolidation_period_days: 30,
        consolidation_request_id: selectedRequest.id,
        status: 'en_transito'
      });

      for (const pkgId of selectedPackages) {
        await base44.entities.Package.update(pkgId, {
          status: 'consolidado',
          consolidation_id: consolidation.id
        });
      }

      await base44.entities.ConsolidationRequest.update(selectedRequest.id, {
        status: 'consolidada',
        consolidation_id: consolidation.id
      });

      // Generate invoice synchronously
      try {
        const { generateInvoice } = await import('@/components/invoice/InvoiceGenerator');
        await generateInvoice(consolidation);
      } catch (err) {
        console.error('Error generating invoice:', err);
        toast.error('Advertencia: Error al generar factura');
      }

      import('@/components/NotificationUtils').then(({ sendNotification }) => {
        sendNotification({
          to: selectedRequest.client_email,
          subject: '📦 Tu carga ha sido consolidada y enviada',
          body: `¡Tu carga ha sido consolidada y está en tránsito!\n\nTracking: ${consolidationTracking}\nPaquetes incluidos: ${trackingNumbers.length}\nTotal a pagar: $${calcs.totalCost.toFixed(2)}\n\nSe ha generado tu factura. Por favor realiza el pago para que podamos procesar la entrega.`,
          type: 'consolidation',
          icon: 'truck',
          referenceId: consolidation.id
        });
      });

      toast.success('Consolidación creada y enviada');
      setSelectedRequest(null);
      loadData();
    } catch (error) {
      toast.error('Error al consolidar');
    }
    setProcessing(false);
  };

  const handleExportApproved = () => {
    let exportText = '';
    
    requests.forEach((req) => {
      const shippingMark = req.shipping_mark || 'TLEC-NO-MARK';
      exportText += `TLEC-${shippingMark}\n`;
      
      req.tracking_numbers?.forEach((tracking) => {
        exportText += `${tracking}\n`;
      });
      
      exportText += '\n';
    });

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consolidaciones-aprobadas-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const handleUndoConsolidation = async () => {
    if (!undoTracking.trim()) {
      toast.error('Ingresa el tracking de consolidación');
      return;
    }

    if (!confirm(`¿Deshacer consolidación ${undoTracking}? Los paquetes volverán a estar disponibles.`)) {
      return;
    }

    setUndoing(true);
    try {
      const response = await base44.functions.invoke('undoConsolidation', {
        consolidation_tracking: undoTracking.trim()
      });

      if (response.data.success) {
        toast.success(`Consolidación deshecha. ${response.data.packages_restored} paquetes restaurados`);
        setUndoTracking('');
        loadData();
      }
    } catch (error) {
      toast.error('Error al deshacer consolidación');
    }
    setUndoing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (selectedRequest) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedRequest(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Consolidar Físicamente</h1>
            <p className="text-slate-500">Ingresa los detalles de la consolidación física</p>
          </div>
        </div>

        {/* Packages Selection */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b">
            <CardTitle>
              Paquetes de {selectedRequest.shipping_mark}
              <p className="text-sm font-normal text-slate-500 mt-1">
                Puedes agregar más paquetes del mismo cliente si es necesario
              </p>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {allPackages.map((pkg) => {
                const isFromRequest = selectedRequest.package_ids?.includes(pkg.id);
                return (
                  <div 
                    key={pkg.id} 
                    className={`p-4 flex items-center gap-4 cursor-pointer transition-colors ${
                      selectedPackages.includes(pkg.id) ? 'bg-purple-50' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => togglePackage(pkg.id)}
                  >
                    <Checkbox 
                      checked={selectedPackages.includes(pkg.id)}
                      onCheckedChange={() => togglePackage(pkg.id)}
                    />
                    <div className="p-2 bg-slate-100 rounded-lg">
                      {pkg.shipping_type === 'aereo' 
                        ? <Plane className="h-5 w-5 text-blue-600" />
                        : <Ship className="h-5 w-5 text-blue-600" />
                      }
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-medium">{pkg.tracking_number}</p>
                        {isFromRequest && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs">Solicitado</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{pkg.description || 'Sin descripción'}</p>
                    </div>
                    {pkg.has_insurance && (
                      <div className="text-right">
                        <p className="text-sm text-emerald-600 font-medium">Asegurado</p>
                        <p className="text-sm text-slate-500">FOB: ${pkg.fob_value}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Consolidation Details */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Detalles Físicos de la Consolidación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Tipo de Envío</Label>
              <Select value={selectedShippingType} onValueChange={setSelectedShippingType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config?.shipping_type_air_enabled !== false && (
                    <SelectItem value="aereo">
                      <div className="flex items-center gap-2">
                        <Plane className="h-4 w-4" />
                        Aéreo
                      </div>
                    </SelectItem>
                  )}
                  {config?.shipping_type_sea_enabled !== false && (
                    <SelectItem value="maritimo">
                      <div className="flex items-center gap-2">
                        <Ship className="h-4 w-4" />
                        Marítimo
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Método de Ingreso</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setInputMode('dimensions')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    inputMode === 'dimensions'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Ruler className={`h-5 w-5 mx-auto mb-1 ${
                    inputMode === 'dimensions' ? 'text-purple-600' : 'text-slate-400'
                  }`} />
                  <span className="text-sm font-medium">Dimensiones</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('cbm')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    inputMode === 'cbm'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Box className={`h-5 w-5 mx-auto mb-1 ${
                    inputMode === 'cbm' ? 'text-purple-600' : 'text-slate-400'
                  }`} />
                  <span className="text-sm font-medium">CBM Total</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Weight className="h-4 w-4" /> Peso Real (kg)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={consolidationData.real_weight_kg}
                onChange={(e) => setConsolidationData({ ...consolidationData, real_weight_kg: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {inputMode === 'dimensions' ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Ruler className="h-4 w-4" /> Largo (cm)
                  </Label>
                  <Input
                    type="number"
                    value={consolidationData.length_cm}
                    onChange={(e) => setConsolidationData({ ...consolidationData, length_cm: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ancho (cm)</Label>
                  <Input
                    type="number"
                    value={consolidationData.width_cm}
                    onChange={(e) => setConsolidationData({ ...consolidationData, width_cm: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Alto (cm)</Label>
                  <Input
                    type="number"
                    value={consolidationData.height_cm}
                    onChange={(e) => setConsolidationData({ ...consolidationData, height_cm: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Box className="h-4 w-4" /> CBM Total (m³)
                </Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={directCbm}
                  onChange={(e) => setDirectCbm(e.target.value)}
                  placeholder="0.0000"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Fecha Estimada de Entrega
              </Label>
              <Input
                type="date"
                value={consolidationData.estimated_delivery}
                onChange={(e) => setConsolidationData({ ...consolidationData, estimated_delivery: e.target.value })}
              />
            </div>

            {/* Insurance Controls */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-600" />
                  <Label className="text-base font-semibold">Seguro de Carga</Label>
                </div>
                <Checkbox
                  checked={hasInsurance}
                  onCheckedChange={setHasInsurance}
                />
              </div>

              {hasInsurance && (
                <div className="space-y-2 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Valor FOB Total
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={customFobValue}
                    onChange={(e) => setCustomFobValue(e.target.value)}
                    placeholder="0.00"
                    className="bg-white"
                  />
                  <p className="text-xs text-emerald-700">
                    Seguro: {config?.insurance_percentage || 5}% del FOB = ${((parseFloat(customFobValue) || 0) * ((config?.insurance_percentage || 5) / 100)).toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {consolidationData.real_weight_kg && ((inputMode === 'dimensions' && consolidationData.length_cm && consolidationData.width_cm && consolidationData.height_cm) || (inputMode === 'cbm' && directCbm)) && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                    Resumen de Costos - {selectedShippingType === 'aereo' ? 'Aéreo' : 'Marítimo'}
                  </h4>
                  
                  {/* Estado del cliente */}
                  {clientUser?.state && (
                    <div className="mb-3 p-2 bg-white rounded border border-blue-200">
                      <p className="text-xs text-slate-500">Estado del Cliente</p>
                      <p className="font-medium text-sm">{stateConfig?.state_name || clientUser.state}</p>
                    </div>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">CBM:</span>
                      <span className="font-medium">{calculateValues().cbm.toFixed(4)} m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Peso Volumétrico:</span>
                      <span className="font-medium">{calculateValues().volumetricWeight.toFixed(2)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Peso Facturable:</span>
                      <span className="font-medium">{calculateValues().billableWeight.toFixed(2)} kg</span>
                    </div>
                    
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Tarifa Base:</span>
                        <span className="font-medium">${calculateValues().baseRate.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Beneficio ({calculateValues().profitPercentage}%):</span>
                        <span className="font-medium">${(calculateValues().baseRate * calculateValues().profitPercentage / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Costo Envío:</span>
                        <span className="font-medium">${calculateValues().shippingCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Tarifa Estado:</span>
                        <span className="font-medium">${calculateValues().stateShippingRate.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Puerta a Puerta:</span>
                        <span className="font-medium">${calculateValues().doorToDoorCost.toFixed(2)}</span>
                      </div>
                      {hasInsurance && (
                        <div className="flex justify-between text-emerald-700">
                          <span className="font-medium">Seguro ({config?.insurance_percentage || 5}%):</span>
                          <span className="font-medium">${calculateValues().insuranceCost.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">Total:</span>
                        <span className="text-lg font-bold text-emerald-600">${calculateValues().totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            onClick={handleConsolidate}
            disabled={processing || !consolidationData.real_weight_kg || (inputMode === 'dimensions' ? !consolidationData.length_cm : !directCbm)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {processing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Consolidando...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4 mr-2" /> Consolidar y Enviar</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  const filteredRequests = requests.filter(req => {
    const searchLower = search.toLowerCase();
    return (
      req.client_email?.toLowerCase().includes(searchLower) ||
      req.shipping_mark?.toLowerCase().includes(searchLower) ||
      req.tracking_numbers?.some(t => t.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Consolidaciones Aprobadas</h1>
        <p className="text-slate-500">Solicitudes listas para consolidar físicamente en el depósito</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendientes de Consolidar</p>
                <p className="text-3xl font-bold text-slate-800">{requests.length}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <Layers className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-white">
          <CardContent className="p-5">
            <Label className="text-sm text-slate-500 mb-2 block">Deshacer Consolidación</Label>
            <div className="flex gap-2">
              <Input
                placeholder="CON-TLEC-..."
                value={undoTracking}
                onChange={(e) => setUndoTracking(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                onClick={handleUndoConsolidation}
                disabled={undoing || !undoTracking.trim()}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                {undoing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente, shipping mark, tracking..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {requests.length > 0 && (
              <Button
                onClick={handleExportApproved}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <Layers className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin consolidaciones pendientes</h3>
              <p className="text-slate-500">No hay solicitudes aprobadas para consolidar</p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((req) => (
            <Card key={req.id} className="border-0 shadow-md hover:shadow-lg transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <Layers className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <User className="h-4 w-4 text-slate-400" />
                          <p className="font-medium text-slate-800">{req.client_email}</p>
                        </div>
                        <Badge variant="outline" className="font-mono">{req.shipping_mark}</Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        {req.shipping_type === 'aereo' 
                          ? <><Plane className="h-4 w-4" /> Aéreo</>
                          : <><Ship className="h-4 w-4" /> Marítimo</>
                        }
                        <span className="flex items-center gap-1">
                          <Package className="h-4 w-4" />
                          {req.tracking_numbers?.length || 0} paquetes
                        </span>
                      </div>

                      <div className="pt-2">
                        <p className="text-xs text-slate-500 mb-2">Paquetes:</p>
                        <div className="flex flex-wrap gap-1">
                          {req.tracking_numbers?.map((tracking) => (
                            <Badge key={tracking} variant="outline" className="font-mono text-xs">
                              <Package className="h-3 w-3 mr-1" />
                              {tracking}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => selectRequest(req)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Layers className="h-4 w-4 mr-2" />
                    Consolidar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}