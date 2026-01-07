import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Layers, 
  Package, 
  Users,
  ArrowRight,
  ArrowLeft,
  Plane,
  Ship,
  Calendar,
  Weight,
  Ruler,
  DollarSign,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';

export default function AdminConsolidate({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientPackages, setClientPackages] = useState([]);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [config, setConfig] = useState(null);
  const [step, setStep] = useState(1); // 1: select client, 2: select packages, 3: details
  const [consolidationData, setConsolidationData] = useState({
    shipping_type: 'aereo',
    real_weight_kg: '',
    length_cm: '',
    width_cm: '',
    height_cm: '',
    estimated_delivery: ''
  });
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [packages, configs] = await Promise.all([
      base44.entities.Package.filter({ status: 'recibido' }),
      base44.entities.AppConfig.filter({ config_key: 'main' })
    ]);

    // Group by client
    const clientMap = {};
    packages.forEach(pkg => {
      if (!clientMap[pkg.client_email]) {
        clientMap[pkg.client_email] = {
          email: pkg.client_email,
          shipping_mark: pkg.shipping_mark,
          packages: []
        };
      }
      clientMap[pkg.client_email].packages.push(pkg);
    });

    setClients(Object.values(clientMap));
    if (configs.length > 0) setConfig(configs[0]);
    setLoading(false);
  };

  const selectClient = (client) => {
    setSelectedClient(client);
    setClientPackages(client.packages);
    setSelectedPackages([]);
    setStep(2);
  };

  const togglePackage = (pkgId) => {
    setSelectedPackages(prev => 
      prev.includes(pkgId) 
        ? prev.filter(id => id !== pkgId)
        : [...prev, pkgId]
    );
  };

  const selectAllPackages = () => {
    if (selectedPackages.length === clientPackages.length) {
      setSelectedPackages([]);
    } else {
      setSelectedPackages(clientPackages.map(p => p.id));
    }
  };

  const calculateValues = () => {
    const { length_cm, width_cm, height_cm, real_weight_kg } = consolidationData;
    const l = parseFloat(length_cm) || 0;
    const w = parseFloat(width_cm) || 0;
    const h = parseFloat(height_cm) || 0;
    const realWeight = parseFloat(real_weight_kg) || 0;

    const cbm = (l * w * h) / 1000000;
    const volumetricWeight = (l * w * h) / 5000;
    const billableWeight = Math.max(realWeight, volumetricWeight);

    // Calculate costs
    const selectedPkgs = clientPackages.filter(p => selectedPackages.includes(p.id));
    const totalFOB = selectedPkgs.reduce((sum, p) => sum + (p.has_insurance ? (p.fob_value || 0) : 0), 0);
    const insuranceCost = totalFOB * ((config?.insurance_percentage || 5) / 100);

    let shippingCost = 0;
    if (consolidationData.shipping_type === 'aereo') {
      shippingCost = billableWeight * (config?.rate_per_kg || 0);
    } else {
      shippingCost = cbm * (config?.rate_per_cbm || 0);
    }

    return {
      cbm,
      volumetricWeight,
      billableWeight,
      shippingCost,
      insuranceCost,
      totalCost: shippingCost + insuranceCost
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
      const selectedPkgs = clientPackages.filter(p => selectedPackages.includes(p.id));
      const trackingNumbers = selectedPkgs.map(p => p.tracking_number);
      
      // Generate tracking
      const date = new Date();
      const dateStr = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const consolidationTracking = `CON-${selectedClient.shipping_mark || 'TLEC'}-${random}-${dateStr}`;

      // Create consolidation
      const consolidation = await base44.entities.Consolidation.create({
        consolidation_tracking: consolidationTracking,
        client_email: selectedClient.email,
        shipping_mark: selectedClient.shipping_mark,
        package_ids: selectedPackages,
        tracking_numbers: trackingNumbers,
        shipping_type: consolidationData.shipping_type,
        real_weight_kg: parseFloat(consolidationData.real_weight_kg),
        length_cm: parseFloat(consolidationData.length_cm),
        width_cm: parseFloat(consolidationData.width_cm),
        height_cm: parseFloat(consolidationData.height_cm),
        cbm: calcs.cbm,
        volumetric_weight: calcs.volumetricWeight,
        billable_weight: calcs.billableWeight,
        shipping_cost: calcs.shippingCost,
        insurance_cost: calcs.insuranceCost,
        total_cost: calcs.totalCost,
        estimated_delivery: consolidationData.estimated_delivery,
        status: 'pendiente_pago'
      });

      // Update packages
      for (const pkgId of selectedPackages) {
        await base44.entities.Package.update(pkgId, {
          status: 'consolidado',
          consolidation_id: consolidation.id
        });
      }

      // Notify client
      await base44.integrations.Core.SendEmail({
        to: selectedClient.email,
        subject: '📦 Tu carga ha sido consolidada',
        body: `¡Tu carga ha sido consolidada!\n\nTracking: ${consolidationTracking}\nPaquetes incluidos: ${trackingNumbers.length}\nTotal a pagar: $${calcs.totalCost.toFixed(2)}\n\nPor favor ingresa al sistema para realizar el pago.`
      });

      toast.success('Consolidación creada exitosamente');
      navigate(createPageUrl('AdminDashboard'));
    } catch (error) {
      toast.error('Error al crear consolidación');
    }
    setProcessing(false);
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
      <div className="flex items-center gap-4">
        {step > 1 && (
          <Button variant="ghost" size="icon" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Consolidar Paquetes</h1>
          <p className="text-slate-500">
            {step === 1 && 'Selecciona un cliente con paquetes recibidos'}
            {step === 2 && 'Selecciona los paquetes a consolidar'}
            {step === 3 && 'Ingresa los detalles de la consolidación'}
          </p>
        </div>
      </div>

      {/* Step 1: Select Client */}
      {step === 1 && (
        <div className="grid gap-4">
          {clients.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-12 text-center">
                <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin paquetes para consolidar</h3>
                <p className="text-slate-500">No hay clientes con paquetes en estado "Recibido"</p>
              </CardContent>
            </Card>
          ) : (
            clients.map((client) => (
              <Card 
                key={client.email} 
                className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => selectClient(client)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                        <Users className="h-6 w-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{client.email}</p>
                        <p className="text-sm text-slate-500 font-mono">{client.shipping_mark || 'Sin shipping mark'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-800">{client.packages.length}</p>
                        <p className="text-sm text-slate-500">paquetes</p>
                      </div>
                      <Button className="bg-purple-600 hover:bg-purple-700">
                        Consolidar <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Step 2: Select Packages */}
      {step === 2 && (
        <div className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Paquetes de {selectedClient?.email}</CardTitle>
                <Button variant="outline" size="sm" onClick={selectAllPackages}>
                  {selectedPackages.length === clientPackages.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {clientPackages.map((pkg) => (
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
                      <p className="font-mono font-medium">{pkg.tracking_number}</p>
                      <p className="text-sm text-slate-500">{pkg.description || 'Sin descripción'}</p>
                    </div>
                    {pkg.has_insurance && (
                      <div className="text-right">
                        <p className="text-sm text-emerald-600 font-medium">Asegurado</p>
                        <p className="text-sm text-slate-500">FOB: ${pkg.fob_value}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button 
              onClick={() => setStep(3)} 
              disabled={selectedPackages.length === 0}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Continuar <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Consolidation Details */}
      {step === 3 && (
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Detalles de la Consolidación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Shipping Type */}
              <div className="space-y-2">
                <Label>Tipo de Envío</Label>
                <Select 
                  value={consolidationData.shipping_type}
                  onValueChange={(val) => setConsolidationData({ ...consolidationData, shipping_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aereo">
                      <div className="flex items-center gap-2">
                        <Plane className="h-4 w-4" /> Aéreo
                      </div>
                    </SelectItem>
                    <SelectItem value="maritimo">
                      <div className="flex items-center gap-2">
                        <Ship className="h-4 w-4" /> Marítimo
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dimensions */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

              {/* Estimated Delivery */}
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

              {/* Calculations Preview */}
              {consolidationData.real_weight_kg && consolidationData.length_cm && consolidationData.width_cm && consolidationData.height_cm && (
                <Card className="bg-slate-50 border-slate-200">
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                      Resumen de Costos
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">CBM:</span>
                        <span className="ml-2 font-medium">{calculateValues().cbm.toFixed(4)} m³</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Peso Volumétrico:</span>
                        <span className="ml-2 font-medium">{calculateValues().volumetricWeight.toFixed(2)} kg</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Peso Facturable:</span>
                        <span className="ml-2 font-medium">{calculateValues().billableWeight.toFixed(2)} kg</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Costo Envío:</span>
                        <span className="ml-2 font-medium">${calculateValues().shippingCost.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Costo Seguro:</span>
                        <span className="ml-2 font-medium">${calculateValues().insuranceCost.toFixed(2)}</span>
                      </div>
                      <div className="col-span-2 pt-2 border-t mt-2">
                        <span className="text-lg font-bold">Total:</span>
                        <span className="ml-2 text-lg font-bold text-emerald-600">${calculateValues().totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Atrás
            </Button>
            <Button 
              onClick={handleConsolidate}
              disabled={processing || !consolidationData.real_weight_kg || !consolidationData.length_cm}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {processing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" /> Crear Consolidación</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}