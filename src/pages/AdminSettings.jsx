import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  Save,
  Loader2,
  Building2,
  FileText,
  DollarSign,
  Wallet,
  Download,
  Plane,
  Ship,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings({ user }) {
  const [config, setConfig] = useState({
    config_key: 'main',
    warehouse_address: '',
    contract_text: '',
    rate_air_general: 0,
    rate_air_sensitive: 0,
    rate_sea_general: 0,
    rate_sea_sensitive: 0,
    insurance_percentage: 5,
    wallet_binance: '',
    wallet_usdt_trc20: '',
    binance_instructions: '',
    usdt_instructions: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
    if (configs.length > 0) {
      setConfig(configs[0]);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        await base44.entities.AppConfig.update(configs[0].id, config);
      } else {
        await base44.entities.AppConfig.create(config);
      }
      toast.success('Configuración guardada exitosamente');
    } catch (error) {
      toast.error('Error al guardar');
    }
    setSaving(false);
  };

  const recalculatePendingConsolidations = async () => {
    setRecalculating(true);
    try {
      const pendingConsolidations = await base44.entities.Consolidation.filter({ 
        status: 'pendiente_pago' 
      });

      let updated = 0;
      for (const cons of pendingConsolidations) {
        // Get packages for insurance check
        const packages = await base44.entities.Package.filter({ consolidation_id: cons.id });
        const hasSensitive = packages.some(p => p.has_insurance);
        const totalFOB = packages.reduce((sum, p) => sum + (p.has_insurance ? (p.fob_value || 0) : 0), 0);

        // Recalculate
        const cbm = (cons.length_cm * cons.width_cm * cons.height_cm) / 1000000;
        const volumetricWeight = (cons.length_cm * cons.width_cm * cons.height_cm) / 5000;
        const billableWeight = Math.max(cons.real_weight_kg, volumetricWeight);

        let shippingCost = 0;
        if (cons.shipping_type === 'aereo') {
          const rate = hasSensitive ? config.rate_air_sensitive : config.rate_air_general;
          shippingCost = billableWeight * rate;
        } else {
          const rate = hasSensitive ? config.rate_sea_sensitive : config.rate_sea_general;
          shippingCost = cbm * rate;
        }

        const insuranceCost = totalFOB * (config.insurance_percentage / 100);
        const totalCost = shippingCost + insuranceCost;

        await base44.entities.Consolidation.update(cons.id, {
          cbm,
          volumetric_weight: volumetricWeight,
          billable_weight: billableWeight,
          shipping_cost: shippingCost,
          insurance_cost: insuranceCost,
          total_cost: totalCost
        });

        updated++;
      }

      toast.success(`${updated} consolidaciones actualizadas`);
    } catch (error) {
      toast.error('Error al recalcular');
    }
    setRecalculating(false);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const [packages, users] = await Promise.all([
        base44.entities.Package.list('-created_date'),
        base44.entities.User.filter({ role: 'user' })
      ]);

      const userMap = {};
      users.forEach(u => { userMap[u.email] = u; });

      const csvData = packages.map(pkg => {
        const client = userMap[pkg.client_email] || {};
        return {
          Tracking: pkg.tracking_number,
          Tipo: pkg.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo',
          Fecha: new Date(pkg.created_date).toLocaleDateString(),
          Nombre: client.first_name || '',
          Apellido: client.last_name || '',
          Ciudad: client.city || '',
          WhatsApp: client.whatsapp || '',
          Email: pkg.client_email,
          ShippingMark: pkg.shipping_mark || ''
        };
      });

      const headers = Object.keys(csvData[0] || {});
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pre-alertas-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast.success('CSV exportado exitosamente');
    } catch (error) {
      toast.error('Error al exportar');
    }
    setExporting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configuración General</h1>
          <p className="text-slate-500">Administra la configuración del sistema</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleExportCSV} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Exportar CSV
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar Todo
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="rates">Tarifas</TabsTrigger>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="contract">Contrato</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Información General
              </CardTitle>
              <CardDescription>
                Configura la información básica del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Dirección del Warehouse
                </Label>
                <Textarea
                  value={config.warehouse_address}
                  onChange={(e) => setConfig({ ...config, warehouse_address: e.target.value })}
                  placeholder="Ingresa la dirección completa del warehouse"
                  rows={4}
                />
                <p className="text-xs text-slate-500">
                  Esta dirección será mostrada a los clientes en su dashboard
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rates Tab */}
        <TabsContent value="rates">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                Tarifas de Envío
              </CardTitle>
              <CardDescription>
                Configura las tarifas para envíos aéreos y marítimos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Aéreo */}
              <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Plane className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Envío Aéreo</h3>
                    <p className="text-sm text-slate-500">Tarifas por kilogramo</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Carga General (USD/Kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={config.rate_air_general}
                      onChange={(e) => setConfig({ ...config, rate_air_general: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Carga Sensible (USD/Kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={config.rate_air_sensitive}
                      onChange={(e) => setConfig({ ...config, rate_air_sensitive: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Marítimo */}
              <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Ship className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Envío Marítimo</h3>
                    <p className="text-sm text-slate-500">Tarifas por CBM</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Carga General (USD/CBM)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={config.rate_sea_general}
                      onChange={(e) => setConfig({ ...config, rate_sea_general: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Carga Sensible (USD/CBM)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={config.rate_sea_sensitive}
                      onChange={(e) => setConfig({ ...config, rate_sea_sensitive: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Seguro de Envío</h3>
                    <p className="text-sm text-slate-500">Porcentaje sobre el valor FOB</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Porcentaje de Seguro (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={config.insurance_percentage}
                    onChange={(e) => setConfig({ ...config, insurance_percentage: parseFloat(e.target.value) || 0 })}
                    placeholder="5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wallets Tab */}
        <TabsContent value="wallets">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-purple-600" />
                Wallets de Pago
              </CardTitle>
              <CardDescription>
                Configura las direcciones de wallet para recibir pagos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Binance */}
              <div className="p-6 bg-amber-50 rounded-xl border border-amber-100">
                <h3 className="font-semibold text-slate-800 mb-4">Binance</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Dirección de Wallet</Label>
                    <Input
                      value={config.wallet_binance}
                      onChange={(e) => setConfig({ ...config, wallet_binance: e.target.value })}
                      placeholder="Dirección de wallet Binance"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instrucciones Adicionales</Label>
                    <Textarea
                      value={config.binance_instructions}
                      onChange={(e) => setConfig({ ...config, binance_instructions: e.target.value })}
                      placeholder="Instrucciones para el cliente (ej: usar red específica)"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* USDT TRC20 */}
              <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
                <h3 className="font-semibold text-slate-800 mb-4">USDT TRC20</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Dirección de Wallet</Label>
                    <Input
                      value={config.wallet_usdt_trc20}
                      onChange={(e) => setConfig({ ...config, wallet_usdt_trc20: e.target.value })}
                      placeholder="Dirección de wallet USDT TRC20"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instrucciones Adicionales</Label>
                    <Textarea
                      value={config.usdt_instructions}
                      onChange={(e) => setConfig({ ...config, usdt_instructions: e.target.value })}
                      placeholder="Instrucciones para el cliente"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contract Tab */}
        <TabsContent value="contract">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-600" />
                Contrato de Servicio
              </CardTitle>
              <CardDescription>
                Texto del contrato que deben aceptar los clientes al registrarse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Texto del Contrato</Label>
                <Textarea
                  value={config.contract_text}
                  onChange={(e) => setConfig({ ...config, contract_text: e.target.value })}
                  placeholder="Ingresa el texto completo del contrato de servicio..."
                  rows={20}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-slate-500">
                  Este texto se mostrará a los nuevos usuarios antes de poder usar el sistema
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}