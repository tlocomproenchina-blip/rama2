import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Settings, 
  Save,
  Loader2,
  DollarSign,
  MapPin,
  ShieldCheck,
  Upload,
  Calculator,
  CheckCircle,
  XCircle,
  Search,
  Building2,
  FileText,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

const VENEZUELAN_STATES = [
  { code: 'zulia', name: 'Zulia' },
  { code: 'tachira', name: 'Táchira' },
  { code: 'falcon', name: 'Falcón' },
  { code: 'lara', name: 'Lara' },
  { code: 'trujillo', name: 'Trujillo' },
  { code: 'merida', name: 'Mérida' },
  { code: 'barinas', name: 'Barinas' },
  { code: 'apure', name: 'Apure' },
  { code: 'guarico', name: 'Guárico' },
  { code: 'anzoategui', name: 'Anzoátegui' },
  { code: 'delta_amacuro', name: 'Delta Amacuro' },
  { code: 'amazonas', name: 'Amazonas' },
  { code: 'bolivar', name: 'Bolívar' },
  { code: 'miranda', name: 'Miranda' },
  { code: 'caracas', name: 'Caracas' },
  { code: 'vargas', name: 'Vargas' },
  { code: 'aragua', name: 'Aragua' },
  { code: 'carabobo', name: 'Carabobo' },
  { code: 'cojedes', name: 'Cojedes' },
  { code: 'yaracuy', name: 'Yaracuy' },
  { code: 'portuguesa', name: 'Portuguesa' },
  { code: 'monagas', name: 'Monagas' },
  { code: 'sucre', name: 'Sucre' },
  { code: 'nueva_esparta', name: 'Nueva Esparta' }
];

export default function AdminSettings({ user }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Pricing Config
  const [pricingConfig, setPricingConfig] = useState({
    base_rate_regular: 690,
    base_rate_high_risk: 790,
    profit_percentage: 10,
    door_to_door_cost: 20,
    is_door_to_door_optional: true
  });

  // States Config
  const [statesConfig, setStatesConfig] = useState([]);
  const [stateSearch, setStateSearch] = useState('');
  const [uniformRate, setUniformRate] = useState('');

  // App Config
  const [appConfig, setAppConfig] = useState({
    app_name: 'TLEC Logistics',
    app_tagline: 'Tu socio confiable en envíos',
    app_logo_url: '',
    favicon_url: '',
    warehouse_address: '',
    contract_text: '',
    insurance_percentage: 5,
    invoice_company_name: 'TLEC CARGO LTD',
    invoice_company_tagline: 'Sistema de Envios Internacionales',
    invoice_logo_url: '',
    invoice_overdue_days: 7,
    payment_alert_days: 7,
    shipping_mark_prefix: 'TLEC-'
  });

  // Privacy Config
  const [privacyConfig, setPrivacyConfig] = useState({
    data_retention_days: 90,
    auto_delete_images: true,
    privacy_policy: '',
    terms_of_service: ''
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingInvoiceLogo, setUploadingInvoiceLogo] = useState(false);

  useEffect(() => {
    loadAllConfigs();
  }, []);

  const loadAllConfigs = async () => {
    try {
      // Load pricing config
      const pricingConfigs = await base44.entities.PricingConfig.filter({ config_key: 'main' });
      if (pricingConfigs.length > 0) {
        setPricingConfig(pricingConfigs[0]);
      }

      // Load states config
      const states = await base44.entities.StateConfig.list();
      if (states.length === 0) {
        // Initialize all 24 states
        const initialStates = VENEZUELAN_STATES.map(s => ({
          state_code: s.code,
          state_name: s.name,
          shipping_rate: 0,
          is_active: true
        }));
        await base44.entities.StateConfig.bulkCreate(initialStates);
        setStatesConfig(initialStates);
      } else {
        setStatesConfig(states);
      }

      // Load app config
      const appConfigs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (appConfigs.length > 0) {
        setAppConfig(appConfigs[0]);
      }

      // Load privacy config
      const privacyConfigs = await base44.entities.PrivacyConfig.filter({ config_key: 'main' });
      if (privacyConfigs.length > 0) {
        setPrivacyConfig(privacyConfigs[0]);
      }
    } catch (error) {
      console.error('Error loading configs:', error);
      toast.error('Error al cargar configuración');
    }
    setLoading(false);
  };

  const handleSavePricing = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.PricingConfig.filter({ config_key: 'main' });
      if (existing.length > 0) {
        await base44.entities.PricingConfig.update(existing[0].id, { ...pricingConfig, config_key: 'main' });
      } else {
        await base44.entities.PricingConfig.create({ ...pricingConfig, config_key: 'main' });
      }
      toast.success('Configuración de precios guardada');
    } catch (error) {
      toast.error('Error al guardar precios');
    }
    setSaving(false);
  };

  const handleSaveState = async (state) => {
    try {
      await base44.entities.StateConfig.update(state.id, state);
      toast.success(`${state.state_name} actualizado`);
    } catch (error) {
      toast.error('Error al guardar estado');
    }
  };

  const handleToggleAllStates = async (active) => {
    setSaving(true);
    try {
      for (const state of statesConfig) {
        await base44.entities.StateConfig.update(state.id, { is_active: active });
      }
      setStatesConfig(statesConfig.map(s => ({ ...s, is_active: active })));
      toast.success(active ? 'Todos los estados activados' : 'Todos los estados desactivados');
    } catch (error) {
      toast.error('Error al actualizar estados');
    }
    setSaving(false);
  };

  const handleApplyUniformRate = async () => {
    if (!uniformRate || parseFloat(uniformRate) < 0) {
      toast.error('Ingresa una tarifa válida');
      return;
    }
    setSaving(true);
    try {
      const rate = parseFloat(uniformRate);
      for (const state of statesConfig) {
        await base44.entities.StateConfig.update(state.id, { shipping_rate: rate });
      }
      setStatesConfig(statesConfig.map(s => ({ ...s, shipping_rate: rate })));
      toast.success(`Tarifa uniforme de $${rate} aplicada a todos los estados`);
      setUniformRate('');
    } catch (error) {
      toast.error('Error al aplicar tarifa uniforme');
    }
    setSaving(false);
  };

  const handleSaveGeneral = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (existing.length > 0) {
        await base44.entities.AppConfig.update(existing[0].id, { ...appConfig, config_key: 'main' });
      } else {
        await base44.entities.AppConfig.create({ ...appConfig, config_key: 'main' });
      }
      toast.success('Configuración general guardada');
    } catch (error) {
      toast.error('Error al guardar configuración');
    }
    setSaving(false);
  };

  const handleSavePrivacy = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.PrivacyConfig.filter({ config_key: 'main' });
      if (existing.length > 0) {
        await base44.entities.PrivacyConfig.update(existing[0].id, { ...privacyConfig, config_key: 'main' });
      } else {
        await base44.entities.PrivacyConfig.create({ ...privacyConfig, config_key: 'main' });
      }
      toast.success('Configuración de privacidad guardada');
    } catch (error) {
      toast.error('Error al guardar privacidad');
    }
    setSaving(false);
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAppConfig({ ...appConfig, app_logo_url: file_url });
      toast.success('Logo subido');
    } catch (error) {
      toast.error('Error al subir logo');
    }
    setUploadingLogo(false);
  };

  const handleFaviconUpload = async (file) => {
    if (!file) return;
    setUploadingFavicon(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAppConfig({ ...appConfig, favicon_url: file_url });
      toast.success('Favicon subido');
    } catch (error) {
      toast.error('Error al subir favicon');
    }
    setUploadingFavicon(false);
  };

  const handleInvoiceLogoUpload = async (file) => {
    if (!file) return;
    setUploadingInvoiceLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAppConfig({ ...appConfig, invoice_logo_url: file_url });
      toast.success('Logo de factura subido');
    } catch (error) {
      toast.error('Error al subir logo de factura');
    }
    setUploadingInvoiceLogo(false);
  };

  const filteredStates = statesConfig.filter(state =>
    state.state_name.toLowerCase().includes(stateSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const calculateExample = () => {
    const base = pricingConfig.base_rate_regular;
    const benefit = pricingConfig.profit_percentage;
    const state = 50; // ejemplo
    const doorToDoor = pricingConfig.door_to_door_cost;
    const total = (base * (1 + benefit / 100)) + state + doorToDoor;
    return total.toFixed(2);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Panel de Administración</h1>
        <p className="text-slate-500">Gestión de tarifas, estados y configuración del sistema</p>
      </div>

      <Tabs defaultValue="tarifas" className="space-y-6">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="tarifas" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Tarifas
          </TabsTrigger>
          <TabsTrigger value="estados" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Estados
          </TabsTrigger>
          <TabsTrigger value="pagos" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pagos
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="facturas" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Facturas
          </TabsTrigger>
          <TabsTrigger value="privacidad" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Privacidad
          </TabsTrigger>
          <TabsTrigger value="push" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Push
          </TabsTrigger>
        </TabsList>

        {/* Tab Tarifas */}
        <TabsContent value="tarifas">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Configuración de Precios</CardTitle>
              <CardDescription>
                Gestiona las tarifas base y porcentajes de beneficio del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Tarifa base Regular ($)</Label>
                  <Input
                    type="number"
                    value={pricingConfig.base_rate_regular}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, base_rate_regular: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tarifa base Alto Riesgo ($)</Label>
                  <Input
                    type="number"
                    value={pricingConfig.base_rate_high_risk}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, base_rate_high_risk: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Porcentaje de beneficio (%)</Label>
                  <Input
                    type="number"
                    value={pricingConfig.profit_percentage}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, profit_percentage: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Costo puerta a puerta ($)</Label>
                  <Input
                    type="number"
                    value={pricingConfig.door_to_door_cost}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, door_to_door_cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-800">¿Puerta a puerta opcional?</p>
                  <p className="text-sm text-slate-500">Permite al cliente elegir si desea servicio puerta a puerta</p>
                </div>
                <Switch
                  checked={pricingConfig.is_door_to_door_optional}
                  onCheckedChange={(checked) => setPricingConfig({ ...pricingConfig, is_door_to_door_optional: checked })}
                />
              </div>

              <Button onClick={handleSavePricing} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar configuración
              </Button>

              {/* Fórmula de Cálculo */}
              <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-slate-800">Fórmula de Cálculo</h3>
                </div>
                <div className="space-y-3">
                  <code className="block p-3 bg-white rounded border text-sm">
                    Precio Final = Tarifa Base × (1 + % Beneficio/100) + Tarifa Estado + Puerta a Puerta
                  </code>
                  
                  <div className="p-4 bg-white rounded-lg border">
                    <p className="text-sm font-medium text-slate-700 mb-2">Ejemplo de Cálculo</p>
                    <div className="space-y-1 text-sm text-slate-600">
                      <p>Tarifa Base Regular: ${pricingConfig.base_rate_regular}</p>
                      <p>Porcentaje de Beneficio: {pricingConfig.profit_percentage}%</p>
                      <p>Tarifa Estado (ejemplo): $50</p>
                      <p>Puerta a Puerta: ${pricingConfig.door_to_door_cost}</p>
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="font-bold text-blue-600 text-lg">Precio Final: ${calculateExample()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Estados */}
        <TabsContent value="estados">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Gestión de Estados Venezolanos</CardTitle>
              <CardDescription>
                Configura las tarifas de envío por estado
              </CardDescription>
              <div className="flex items-center gap-2 text-sm text-slate-600 mt-2">
                <span className="font-medium">{statesConfig.filter(s => s.is_active).length} de {statesConfig.length}</span>
                <span>estados activos</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search and Actions */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar estado..."
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => handleToggleAllStates(true)}
                  className="whitespace-nowrap"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Activar todos
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleToggleAllStates(false)}
                  className="whitespace-nowrap"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Desactivar todos
                </Button>
              </div>

              {/* Uniform Rate */}
              <div className="flex gap-3 p-4 bg-slate-50 rounded-lg">
                <Input
                  type="number"
                  placeholder="Tarifa uniforme"
                  value={uniformRate}
                  onChange={(e) => setUniformRate(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleApplyUniformRate} disabled={saving}>
                  Aplicar tarifa uniforme
                </Button>
              </div>

              {/* States Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 font-medium text-slate-700">Estado</th>
                      <th className="text-left p-3 font-medium text-slate-700">Tarifa de Envío ($)</th>
                      <th className="text-center p-3 font-medium text-slate-700">Activo</th>
                      <th className="text-center p-3 font-medium text-slate-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStates.map((state) => (
                      <tr key={state.id} className="border-t hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">{state.state_name}</td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={state.shipping_rate}
                            onChange={(e) => {
                              const updated = statesConfig.map(s =>
                                s.id === state.id ? { ...s, shipping_rate: parseFloat(e.target.value) || 0 } : s
                              );
                              setStatesConfig(updated);
                            }}
                            className="w-32"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <Switch
                            checked={state.is_active}
                            onCheckedChange={(checked) => {
                              const updated = statesConfig.map(s =>
                                s.id === state.id ? { ...s, is_active: checked } : s
                              );
                              setStatesConfig(updated);
                            }}
                          />
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            size="sm"
                            onClick={() => handleSaveState(state)}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Guardar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab General */}
        <TabsContent value="general">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Configuración General de la Aplicación</CardTitle>
              <CardDescription>
                Personaliza la identidad y configuraciones básicas del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Nombre de la aplicación</Label>
                <Input
                  value={appConfig.app_name}
                  onChange={(e) => setAppConfig({ ...appConfig, app_name: e.target.value })}
                  placeholder="TLEC Logistics"
                />
              </div>

              <div className="space-y-2">
                <Label>Eslogan</Label>
                <Input
                  value={appConfig.app_tagline}
                  onChange={(e) => setAppConfig({ ...appConfig, app_tagline: e.target.value })}
                  placeholder="Tu socio confiable en envíos"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Logo de la aplicación</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoUpload(e.target.files[0])}
                    disabled={uploadingLogo}
                  />
                  {appConfig.app_logo_url && (
                    <img src={appConfig.app_logo_url} alt="Logo" className="h-16 w-16 object-contain rounded border" />
                  )}
                  <p className="text-xs text-slate-500">Sin archivos seleccionados</p>
                </div>

                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFaviconUpload(e.target.files[0])}
                    disabled={uploadingFavicon}
                  />
                  {appConfig.favicon_url && (
                    <img src={appConfig.favicon_url} alt="Favicon" className="h-8 w-8 object-contain rounded border" />
                  )}
                  <p className="text-xs text-slate-500">Sin archivos seleccionados</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dirección del almacén</Label>
                <Textarea
                  value={appConfig.warehouse_address}
                  onChange={(e) => setAppConfig({ ...appConfig, warehouse_address: e.target.value })}
                  placeholder="Dirección completa del almacén..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Texto del contrato de servicio</Label>
                <Textarea
                  value={appConfig.contract_text}
                  onChange={(e) => setAppConfig({ ...appConfig, contract_text: e.target.value })}
                  placeholder="Términos y condiciones del servicio..."
                  rows={8}
                />
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Porcentaje de seguro (%)</Label>
                  <Input
                    type="number"
                    value={appConfig.insurance_percentage}
                    onChange={(e) => setAppConfig({ ...appConfig, insurance_percentage: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Días para vencimiento de factura</Label>
                  <Input
                    type="number"
                    value={appConfig.invoice_overdue_days}
                    onChange={(e) => setAppConfig({ ...appConfig, invoice_overdue_days: parseInt(e.target.value) || 7 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Días para alertas de pago</Label>
                  <Input
                    type="number"
                    value={appConfig.payment_alert_days}
                    onChange={(e) => setAppConfig({ ...appConfig, payment_alert_days: parseInt(e.target.value) || 7 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prefijo de Shipping Mark</Label>
                <Input
                  value={appConfig.shipping_mark_prefix}
                  onChange={(e) => setAppConfig({ ...appConfig, shipping_mark_prefix: e.target.value })}
                  placeholder="TLEC-"
                />
              </div>

              <Button onClick={handleSaveGeneral} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar cambios
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Privacidad */}
        <TabsContent value="privacidad">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Privacidad y Gestión de Datos</CardTitle>
              <CardDescription>
                Configura políticas de retención y privacidad de datos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Retención de datos (días)</Label>
                <Input
                  type="number"
                  value={privacyConfig.data_retention_days}
                  onChange={(e) => setPrivacyConfig({ ...privacyConfig, data_retention_days: parseInt(e.target.value) || 90 })}
                />
                <p className="text-xs text-slate-500">
                  Número de días que se mantienen los datos antes de la eliminación automática
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-800">Eliminación automática de imágenes</p>
                  <p className="text-sm text-slate-500">Eliminar automáticamente imágenes de paquetes después de la entrega</p>
                </div>
                <Switch
                  checked={privacyConfig.auto_delete_images}
                  onCheckedChange={(checked) => setPrivacyConfig({ ...privacyConfig, auto_delete_images: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Política de privacidad</Label>
                <Textarea
                  value={privacyConfig.privacy_policy}
                  onChange={(e) => setPrivacyConfig({ ...privacyConfig, privacy_policy: e.target.value })}
                  placeholder="Escribe la política de privacidad completa..."
                  rows={8}
                />
              </div>

              <div className="space-y-2">
                <Label>Términos de servicio</Label>
                <Textarea
                  value={privacyConfig.terms_of_service}
                  onChange={(e) => setPrivacyConfig({ ...privacyConfig, terms_of_service: e.target.value })}
                  placeholder="Escribe los términos de servicio..."
                  rows={8}
                />
              </div>

              <Button onClick={handleSavePrivacy} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar cambios
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Pagos */}
        <TabsContent value="pagos">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Wallets de Pago
              </CardTitle>
              <CardDescription>
                Configura las direcciones de wallet para recibir pagos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Binance */}
              <div className="p-6 bg-amber-50 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-800">Binance</h3>
                <div className="space-y-2">
                  <Label>Dirección de Wallet</Label>
                  <Input
                    value={appConfig.wallet_binance || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, wallet_binance: e.target.value })}
                    placeholder="Dirección de wallet Binance"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones Adicionales</Label>
                  <Textarea
                    value={appConfig.binance_instructions || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, binance_instructions: e.target.value })}
                    placeholder="Instrucciones para el cliente (ej: usar red específica)"
                    rows={3}
                  />
                </div>
              </div>

              {/* USDT TRC20 */}
              <div className="p-6 bg-blue-50 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-800">USDT TRC20</h3>
                <div className="space-y-2">
                  <Label>Dirección de Wallet</Label>
                  <Input
                    value={appConfig.wallet_usdt_trc20 || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, wallet_usdt_trc20: e.target.value })}
                    placeholder="Dirección de wallet USDT TRC20"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones Adicionales</Label>
                  <Textarea
                    value={appConfig.usdt_instructions || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, usdt_instructions: e.target.value })}
                    placeholder="Instrucciones para el cliente"
                    rows={3}
                  />
                </div>
              </div>

              {/* PayPal */}
              <div className="p-6 bg-indigo-50 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-800">PayPal</h3>
                <div className="space-y-2">
                  <Label>Email de PayPal</Label>
                  <Input
                    value={appConfig.wallet_paypal || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, wallet_paypal: e.target.value })}
                    placeholder="tu-email@paypal.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones Adicionales</Label>
                  <Textarea
                    value={appConfig.paypal_instructions || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, paypal_instructions: e.target.value })}
                    placeholder="Instrucciones para el cliente"
                    rows={3}
                  />
                </div>
              </div>

              {/* Débito Internacional */}
              <div className="p-6 bg-purple-50 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-800">Débito Internacional</h3>
                <div className="space-y-2">
                  <Label>Datos de la Tarjeta/Cuenta</Label>
                  <Input
                    value={appConfig.wallet_debito_internacional || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, wallet_debito_internacional: e.target.value })}
                    placeholder="Datos para débito internacional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones Adicionales</Label>
                  <Textarea
                    value={appConfig.debito_internacional_instructions || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, debito_internacional_instructions: e.target.value })}
                    placeholder="Instrucciones para el cliente"
                    rows={3}
                  />
                </div>
              </div>

              {/* Wally */}
              <div className="p-6 bg-amber-50 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-800">Wally</h3>
                <div className="space-y-2">
                  <Label>Usuario/Teléfono Wally</Label>
                  <Input
                    value={appConfig.wallet_wally || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, wallet_wally: e.target.value })}
                    placeholder="Usuario o teléfono Wally"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones Adicionales</Label>
                  <Textarea
                    value={appConfig.wally_instructions || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, wally_instructions: e.target.value })}
                    placeholder="Instrucciones para el cliente"
                    rows={3}
                  />
                </div>
              </div>

              {/* Zinli */}
              <div className="p-6 bg-blue-50 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-800">Zinli</h3>
                <div className="space-y-2">
                  <Label>Usuario/Teléfono Zinli</Label>
                  <Input
                    value={appConfig.wallet_zinli || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, wallet_zinli: e.target.value })}
                    placeholder="Usuario o teléfono Zinli"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones Adicionales</Label>
                  <Textarea
                    value={appConfig.zinli_instructions || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, zinli_instructions: e.target.value })}
                    placeholder="Instrucciones para el cliente"
                    rows={3}
                  />
                </div>
              </div>

              {/* Wise */}
              <div className="p-6 bg-indigo-50 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-800">Wise</h3>
                <div className="space-y-2">
                  <Label>Email/Datos Wise</Label>
                  <Input
                    value={appConfig.wallet_wise || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, wallet_wise: e.target.value })}
                    placeholder="Email o datos Wise"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones Adicionales</Label>
                  <Textarea
                    value={appConfig.wise_instructions || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, wise_instructions: e.target.value })}
                    placeholder="Instrucciones para el cliente"
                    rows={3}
                  />
                </div>
              </div>

              {/* Skrill */}
              <div className="p-6 bg-purple-50 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-800">Skrill</h3>
                <div className="space-y-2">
                  <Label>Email Skrill</Label>
                  <Input
                    value={appConfig.wallet_skrill || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, wallet_skrill: e.target.value })}
                    placeholder="tu-email@skrill.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones Adicionales</Label>
                  <Textarea
                    value={appConfig.skrill_instructions || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, skrill_instructions: e.target.value })}
                    placeholder="Instrucciones para el cliente"
                    rows={3}
                  />
                </div>
              </div>

              {/* Zelle */}
              <div className="p-6 bg-amber-50 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-800">Zelle</h3>
                <div className="space-y-2">
                  <Label>Email/Teléfono Zelle</Label>
                  <Input
                    value={appConfig.wallet_zelle || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, wallet_zelle: e.target.value })}
                    placeholder="Email o teléfono Zelle"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones Adicionales</Label>
                  <Textarea
                    value={appConfig.zelle_instructions || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, zelle_instructions: e.target.value })}
                    placeholder="Instrucciones para el cliente"
                    rows={3}
                  />
                </div>
              </div>

              {/* Pago Móvil → USDT */}
              <div className="p-6 bg-blue-50 rounded-xl space-y-4">
                <h3 className="font-semibold text-slate-800">Pago Móvil → USDT</h3>
                <div className="space-y-2">
                  <Label>Datos de Pago Móvil/USDT</Label>
                  <Input
                    value={appConfig.wallet_pago_movil_usdt || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, wallet_pago_movil_usdt: e.target.value })}
                    placeholder="Teléfono o datos de conversión"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones Adicionales</Label>
                  <Textarea
                    value={appConfig.pago_movil_usdt_instructions || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, pago_movil_usdt_instructions: e.target.value })}
                    placeholder="Instrucciones para el cliente"
                    rows={3}
                  />
                </div>
              </div>

              <Button onClick={handleSaveGeneral} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar configuración de pagos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>



        <TabsContent value="facturas">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Configuración de Factura
              </CardTitle>
              <CardDescription>
                Personaliza la información que aparece en las facturas PDF
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Nombre de la Empresa</Label>
                <Input
                  value={appConfig.invoice_company_name || ''}
                  onChange={(e) => setAppConfig({ ...appConfig, invoice_company_name: e.target.value })}
                  placeholder="TLEC CARGO LTD"
                />
                <p className="text-xs text-slate-500">Nombre que aparecerá en el encabezado de la factura</p>
              </div>

              <div className="space-y-2">
                <Label>Eslogan/Descripción</Label>
                <Input
                  value={appConfig.invoice_company_tagline || ''}
                  onChange={(e) => setAppConfig({ ...appConfig, invoice_company_tagline: e.target.value })}
                  placeholder="Sistema de Envios Internacionales"
                />
                <p className="text-xs text-slate-500">Texto que aparece debajo del nombre de la empresa</p>
              </div>

              <div className="space-y-2">
                <Label>Logo para Facturas (Relación 1:1)</Label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <label className="block">
                      <div className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <Upload className="h-4 w-4 text-slate-600" />
                        <span className="text-sm text-slate-700">
                          {uploadingInvoiceLogo ? 'Subiendo...' : 'Seleccionar archivo'}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleInvoiceLogoUpload(e.target.files[0])}
                        disabled={uploadingInvoiceLogo}
                      />
                    </label>
                    <p className="text-xs text-slate-500 mt-2">
                      {appConfig.invoice_logo_url ? 'Archivo cargado' : 'Sin archivos seleccionados'}
                    </p>
                  </div>
                  {appConfig.invoice_logo_url && (
                    <div className="flex-shrink-0">
                      <img 
                        src={appConfig.invoice_logo_url} 
                        alt="Logo Factura" 
                        className="h-16 w-16 object-contain rounded border border-slate-200" 
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="text-amber-600 mt-0.5">⚠️</div>
                  <p className="text-xs text-amber-800">
                    <strong>IMPORTANTE:</strong> Usa una imagen cuadrada (1:1) para mejor visualización en facturas. El logo aparecerá en el encabezado de todas las facturas PDF.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-600" />
                    <Label>Días para considerar factura vencida</Label>
                  </div>
                  <Input
                    type="number"
                    value={appConfig.invoice_overdue_days || 7}
                    onChange={(e) => setAppConfig({ ...appConfig, invoice_overdue_days: parseInt(e.target.value) || 7 })}
                  />
                  <p className="text-xs text-slate-500">Número de días para que una factura se considere vencida</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-600" />
                    <Label>Días para alertas de pago</Label>
                  </div>
                  <Input
                    type="number"
                    value={appConfig.payment_alert_days || 7}
                    onChange={(e) => setAppConfig({ ...appConfig, payment_alert_days: parseInt(e.target.value) || 7 })}
                  />
                  <p className="text-xs text-slate-500">Número de días para generar alertas de pagos pendientes</p>
                </div>
              </div>

              <Button onClick={handleSaveGeneral} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar configuración de facturas
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="push">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Notificaciones Push</CardTitle>
              <CardDescription>En desarrollo</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}