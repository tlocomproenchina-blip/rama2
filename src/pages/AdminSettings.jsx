import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Clock,
  Trash2,
  HardDrive,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import ResourceInspector from '@/components/admin/ResourceInspector';
import PaymentMethodsSettings from '@/components/admin/PaymentMethodsSettings';
import ShippingMarkAutomationSettings from '@/components/admin/ShippingMarkAutomationSettings';
import DesignPhaseOneStudio from '@/components/admin/DesignPhaseOneStudio';
import { createPageUrl } from '@/utils';

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
      app_name: 'TLEC CARGO',
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
      shipping_mark_prefix: 'TLEC-',
      shipping_type_air_enabled: true,
      shipping_type_sea_enabled: true,
      allow_profile_updates: true,
      consolidation_periods: [15, 20, 30],
      whatsapp_enabled: false,
      whatsapp_number: '',
      whatsapp_message: '',
      whatsapp_icon_url: '',
      maintenance_mode: false,
      maintenance_message: 'Estamos realizando mantenimiento. Por favor, inténtalo más tarde.',
      maintenance_image_url: '',
      shipping_mark_auto_assign_enabled: false,
      shipping_mark_auto_assign_prefix: 'TLEC-',
      shipping_mark_auto_assign_length: 6,
      shipping_mark_auto_assign_chars: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
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
  const [uploadingShippingMarkExample, setUploadingShippingMarkExample] = useState(false);
  const [uploadingWhatsAppIcon, setUploadingWhatsAppIcon] = useState(false);

  // Cache clear countdown
  const [clearing, setClearing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(10);

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
      toast.success(`${state.state_name} guardado exitosamente`);
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

  // Guardado inmediato para el toggle de Actualización de Perfil
  const toggleAllowProfileUpdates = async (checked) => {
    // Optimista en UI
    const prev = appConfig;
    const next = { ...prev, allow_profile_updates: checked };
    setAppConfig(next);
    try {
      const existing = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (existing.length > 0) {
        // Actualizar SOLO los campos necesarios (evita enviar id/fechas readonly)
        await base44.entities.AppConfig.update(existing[0].id, { allow_profile_updates: checked, config_key: 'main' });
      } else {
        await base44.entities.AppConfig.create({ ...next, config_key: 'main' });
      }
      toast.success(checked ? 'Actualización de perfil habilitada' : 'Actualización de perfil deshabilitada');
    } catch (e) {
      toast.error('No se pudo guardar la configuración');
      // revertir en UI si falla
      setAppConfig(prev);
    }
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

  const handleClearCache = async () => {
    if (clearing) return;
    setClearing(true);
    setSecondsLeft(10);
    let counter = 10;

    const timer = setInterval(async () => {
      counter -= 1;
      setSecondsLeft(counter);

      if (counter <= 0) {
        clearInterval(timer);
        try {
          // Clear all localStorage
          localStorage.clear();
          // Clear sessionStorage
          sessionStorage.clear();

          // Clear IndexedDB (wait for deletions to finish)
          if (typeof indexedDB !== 'undefined') {
            let dbs = [];
            const listFn = indexedDB.databases;
            if (typeof listFn === 'function') {
              try {
                dbs = (await listFn.call(indexedDB)) || [];
              } catch (e) {
                dbs = [];
              }
            }
            const deleteDb = (name) => new Promise((resolve) => {
              if (!name) return resolve();
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            });
            await Promise.all(dbs.map((db) => deleteDb(db.name)));
          }

          toast.success('✓ Cache limpia');
        } catch (error) {
          toast.error('Error al limpiar cache');
        } finally {
          // Ir al dashboard del administrador tras limpiar
          setTimeout(() => {
            window.location.href = createPageUrl('AdminDashboard');
          }, 700);
        }
      }
    }, 1000);
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

  const handleShippingMarkExampleUpload = async (file) => {
    if (!file) return;
    setUploadingShippingMarkExample(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAppConfig({ ...appConfig, shipping_mark_example_image_url: file_url });
      toast.success('Imagen de ejemplo subida');
    } catch (error) {
      toast.error('Error al subir imagen');
    }
    setUploadingShippingMarkExample(false);
  };

  const handleWhatsAppIconUpload = async (file) => {
    if (!file) return;
    setUploadingWhatsAppIcon(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAppConfig({ ...appConfig, whatsapp_icon_url: file_url });
      toast.success('Ícono WhatsApp subido');
    } catch (error) {
      toast.error('Error al subir ícono');
    }
    setUploadingWhatsAppIcon(false);
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
    <div className="space-y-4 md:space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Panel de Administración</h1>
        <p className="text-slate-500">Gestión de tarifas, estados y configuración del sistema</p>
      </div>

      <Tabs defaultValue="tarifas" className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="grid grid-cols-9 w-full rounded-2xl p-1">
            <TabsTrigger value="tarifas" className="flex items-center gap-2 text-xs">
              <DollarSign className="h-4 w-4" />
              <span className="hidden md:inline">Tarifas</span>
            </TabsTrigger>
            <TabsTrigger value="estados" className="flex items-center gap-2 text-xs">
              <MapPin className="h-4 w-4" />
              <span className="hidden md:inline">Estados</span>
            </TabsTrigger>
            <TabsTrigger value="envios" className="flex items-center gap-2 text-xs">
              <Settings className="h-4 w-4" />
              <span className="hidden md:inline">Envíos</span>
            </TabsTrigger>
            <TabsTrigger value="pagos" className="flex items-center gap-2 text-xs">
              <DollarSign className="h-4 w-4" />
              <span className="hidden md:inline">Pagos</span>
            </TabsTrigger>
            <TabsTrigger value="general" className="flex items-center gap-2 text-xs">
              <Settings className="h-4 w-4" />
              <span className="hidden md:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="diseno" className="flex items-center gap-2 text-xs">
              <Sparkles className="h-4 w-4" />
              <span className="hidden md:inline">Diseño</span>
            </TabsTrigger>
            <TabsTrigger value="facturas" className="flex items-center gap-2 text-xs">
              <FileText className="h-4 w-4" />
              <span className="hidden md:inline">Facturas</span>
            </TabsTrigger>
            <TabsTrigger value="privacidad" className="flex items-center gap-2 text-xs">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden md:inline">Privacidad</span>
            </TabsTrigger>
            <TabsTrigger value="recursos" className="flex items-center gap-2 text-xs">
              <HardDrive className="h-4 w-4" />
              <span className="hidden md:inline">Recursos</span>
            </TabsTrigger>
          </TabsList>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleClearCache}
                  disabled={clearing}
                  className="ml-2 border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {clearing ? `Limpiar Cache (${secondsLeft}s)` : 'Limpiar Cache'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Elimina datos almacenados localmente y recarga la página
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Tab Tarifas */}
        <TabsContent value="tarifas">
          <Card className="rounded-2xl border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Configuración de Precios</CardTitle>
              <CardDescription>
                Gestiona las tarifas base y porcentajes de beneficio del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
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
              <div className="mt-8 p-4 md:p-6 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-slate-800">Fórmula de Cálculo</h3>
                </div>
                <div className="space-y-3">
                  <code className="block p-3 bg-white rounded border text-sm">
                    Tarifa base + Beneficio + Tarifa de Envío (estado) + Puerta a Puerta = Precio Final
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

        {/* Tab Tipos de Envío */}
        <TabsContent value="envios">
          <Card className="rounded-2xl border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Tipos de Envío Disponibles</CardTitle>
              <CardDescription>
                Habilita o deshabilita los tipos de envío que estarán disponibles en todo el sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 md:p-6 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-lg">Envío Aéreo</p>
                      <p className="text-sm text-slate-600">Permite a los usuarios seleccionar envío aéreo</p>
                    </div>
                  </div>
                  <Switch
                    checked={appConfig.shipping_type_air_enabled}
                    onCheckedChange={(checked) => setAppConfig({ ...appConfig, shipping_type_air_enabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 md:p-6 bg-cyan-50 rounded-xl border border-cyan-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-cyan-100 rounded-lg">
                      <svg className="h-6 w-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-lg">Envío Marítimo</p>
                      <p className="text-sm text-slate-600">Permite a los usuarios seleccionar envío marítimo</p>
                    </div>
                  </div>
                  <Switch
                    checked={appConfig.shipping_type_sea_enabled}
                    onCheckedChange={(checked) => setAppConfig({ ...appConfig, shipping_type_sea_enabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 md:p-6 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-lg">Actualización de Perfil</p>
                      <p className="text-sm text-slate-600">Permitir que los clientes actualicen su información</p>
                    </div>
                  </div>
                  <Switch
                     checked={appConfig.allow_profile_updates}
                     onCheckedChange={(checked) => toggleAllowProfileUpdates(checked)}
                   />
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <div className="text-amber-600 mt-0.5">⚠️</div>
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Importante:</p>
                    <p>Al deshabilitar un tipo de envío, este dejará de aparecer en todos los formularios y opciones del sistema para administradores y usuarios. Los envíos existentes no se verán afectados. Desabilitar la actualización de perfil es útil para campañas de renovación de información.</p>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveGeneral} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar configuración
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Estados */}
        <TabsContent value="estados">
          <Card className="rounded-2xl border-0 shadow-lg">
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
            <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
              {/* Search and Actions */}
              <div className="flex flex-col gap-3 sm:flex-row">
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
                  className="whitespace-nowrap w-full sm:w-auto"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Activar todos
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleToggleAllStates(false)}
                  className="whitespace-nowrap w-full sm:w-auto"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Desactivar todos
                </Button>
              </div>

              {/* Uniform Rate */}
              <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-lg sm:flex-row">
                <Input
                  type="number"
                  placeholder="Tarifa uniforme"
                  value={uniformRate}
                  onChange={(e) => setUniformRate(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleApplyUniformRate} disabled={saving} className="w-full sm:w-auto">
                  Aplicar tarifa uniforme
                </Button>
              </div>

              {/* States Table */}
              <div className="space-y-4 md:hidden">
                {filteredStates.map((state) => (
                  <div key={state.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                    <div>
                      <p className="text-xs text-slate-500">Estado</p>
                      <p className="mt-1 font-semibold text-slate-800">{state.state_name}</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Tarifa de Envío ($)</Label>
                      <Input
                        type="number"
                        value={state.shipping_rate}
                        onChange={(e) => {
                          const updated = statesConfig.map(s =>
                            s.id === state.id ? { ...s, shipping_rate: parseFloat(e.target.value) || 0 } : s
                          );
                          setStatesConfig(updated);
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Precio final Regular ($)</p>
                        <p className="mt-1 font-semibold text-slate-800">${(
                          ((pricingConfig?.base_rate_regular || 0) * (1 + (pricingConfig?.profit_percentage || 0)/100))
                          + (state.shipping_rate || 0)
                          + (pricingConfig?.door_to_door_cost || 0)
                        ).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Precio final Alto riesgo ($)</p>
                        <p className="mt-1 font-semibold text-slate-800">${(
                          ((pricingConfig?.base_rate_high_risk || 0) * (1 + (pricingConfig?.profit_percentage || 0)/100))
                          + (state.shipping_rate || 0)
                          + (pricingConfig?.door_to_door_cost || 0)
                        ).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">Activo</p>
                        <p className="text-xs text-slate-500">Habilitar envíos para este estado</p>
                      </div>
                      <Switch
                        checked={state.is_active}
                        onCheckedChange={(checked) => {
                          const updated = statesConfig.map(s =>
                            s.id === state.id ? { ...s, is_active: checked } : s
                          );
                          setStatesConfig(updated);
                        }}
                      />
                    </div>

                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleSaveState(state)}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Guardar
                    </Button>
                  </div>
                ))}
              </div>

              <div className="hidden md:block border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3 font-medium text-slate-700">Estado</th>
                      <th className="text-left p-3 font-medium text-slate-700">Tarifa de Envío ($)</th>
                      <th className="text-left p-3 font-medium text-slate-700">Precio final Regular ($)</th>
                      <th className="text-left p-3 font-medium text-slate-700">Precio final Alto riesgo ($)</th>
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
                        <td className="p-3">
                          <span className="font-semibold">${(
                            ((pricingConfig?.base_rate_regular || 0) * (1 + (pricingConfig?.profit_percentage || 0)/100))
                            + (state.shipping_rate || 0)
                            + (pricingConfig?.door_to_door_cost || 0)
                          ).toFixed(2)}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold">${(
                            ((pricingConfig?.base_rate_high_risk || 0) * (1 + (pricingConfig?.profit_percentage || 0)/100))
                            + (state.shipping_rate || 0)
                            + (pricingConfig?.door_to_door_cost || 0)
                          ).toFixed(2)}</span>
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
          <Card className="rounded-2xl border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Configuración General de la Aplicación</CardTitle>
              <CardDescription>
                Personaliza la identidad y configuraciones básicas del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
              {/* Modo Mantenimiento */}
              <div className="p-4 md:p-6 bg-rose-50 rounded-xl border border-rose-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-lg">Modo mantenimiento</h3>
                    <p className="text-sm text-slate-600">Cierra la app para clientes y muestra un aviso de mantenimiento. Los administradores seguirán teniendo acceso.</p>
                  </div>
                  <Switch
                    checked={!!appConfig.maintenance_mode}
                    onCheckedChange={(checked) => setAppConfig({ ...appConfig, maintenance_mode: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mensaje mostrado</Label>
                  <Textarea
                    value={appConfig.maintenance_message || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, maintenance_message: e.target.value })}
                    rows={2}
                    placeholder="Estamos en mantenimiento. Por favor, intenta más tarde."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Imagen (opcional)</Label>
                  <Input
                    value={appConfig.maintenance_image_url || ''}
                    onChange={(e) => setAppConfig({ ...appConfig, maintenance_image_url: e.target.value })}
                    placeholder="Pega aquí la URL de la imagen de mantenimiento"
                  />
                  <p className="text-xs text-slate-500">Sugerencia: usa una imagen 16:9 para mejor apariencia.</p>
                </div>
                <Button onClick={handleSaveGeneral} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Guardar configuración
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Nombre de la aplicación</Label>
                <Input
                  value={appConfig.app_name}
                  onChange={(e) => setAppConfig({ ...appConfig, app_name: e.target.value })}
                  placeholder="TLEC CARGO"
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
                <Label>Imagen de ejemplo del Shipping Mark</Label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <label className="block">
                      <div className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <Upload className="h-4 w-4 text-slate-600" />
                        <span className="text-sm text-slate-700">
                          {uploadingShippingMarkExample ? 'Subiendo...' : 'Seleccionar archivo'}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleShippingMarkExampleUpload(e.target.files[0])}
                        disabled={uploadingShippingMarkExample}
                      />
                    </label>
                    <p className="text-xs text-slate-500 mt-2">
                      {appConfig.shipping_mark_example_image_url ? 'Archivo cargado' : 'Sin archivos seleccionados'}
                    </p>
                  </div>
                  {appConfig.shipping_mark_example_image_url && (
                    <div className="flex-shrink-0">
                      <img 
                        src={appConfig.shipping_mark_example_image_url} 
                        alt="Ejemplo Shipping Mark" 
                        className="h-24 w-auto object-contain rounded border border-slate-200" 
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descripción de la imagen de ejemplo</Label>
                <Textarea
                  value={appConfig.shipping_mark_example_description || 'Esta imagen se mostrará a los usuarios como ejemplo de cómo debe quedar su shipping mark'}
                  onChange={(e) => setAppConfig({ ...appConfig, shipping_mark_example_description: e.target.value })}
                  placeholder="Escribe el texto que verán los clientes junto a la imagen de ejemplo..."
                  rows={3}
                />
                <p className="text-xs text-slate-500">
                  Este texto aparecerá en el dashboard del cliente junto a la imagen de ejemplo
                </p>
              </div>

              <div className="space-y-2">
                <Label>Porcentaje de seguro (%)</Label>
                <Input
                  type="number"
                  value={appConfig.insurance_percentage}
                  onChange={(e) => setAppConfig({ ...appConfig, insurance_percentage: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <ShippingMarkAutomationSettings appConfig={appConfig} setAppConfig={setAppConfig} />

              {/* Chatbot Configuration */}
               <div className="mt-8 p-4 md:p-6 bg-indigo-50 rounded-xl border border-indigo-200 space-y-4">
                 <div className="flex items-center justify-between">
                   <div>
                     <h3 className="font-semibold text-slate-800 text-lg">Asistente Virtual (AI)</h3>
                     <p className="text-sm text-slate-600 mt-1">Chatbot inteligente para atención al cliente 24/7</p>
                   </div>
                   <Switch
                     checked={appConfig.chatbot_enabled}
                     onCheckedChange={(checked) => setAppConfig({ ...appConfig, chatbot_enabled: checked })}
                   />
                 </div>
                 {appConfig.chatbot_enabled && (
                   <div className="p-4 bg-white rounded-lg border border-indigo-200">
                     <p className="text-sm text-slate-700">
                       ✨ El asistente tiene acceso a:
                     </p>
                     <ul className="text-sm text-slate-600 mt-2 space-y-1 list-disc list-inside">
                       <li>Información de cuenta del cliente</li>
                       <li>Paquetes y consolidaciones</li>
                       <li>Preguntas frecuentes</li>
                     </ul>
                     <p className="text-xs text-slate-500 mt-3">
                       El asistente redirigirá a soporte si no puede responder
                     </p>
                   </div>
                 )}
               </div>

               {/* WhatsApp Configuration */}
               <div className="mt-8 p-4 md:p-6 bg-green-50 rounded-xl border border-green-200 space-y-4">
                 <div className="flex items-center justify-between">
                   <div>
                     <h3 className="font-semibold text-slate-800 text-lg">Configuración WhatsApp</h3>
                     <p className="text-sm text-slate-600 mt-1">Personaliza el botón de soporte por WhatsApp</p>
                   </div>
                   <Switch
                     checked={appConfig.whatsapp_enabled}
                     onCheckedChange={(checked) => setAppConfig({ ...appConfig, whatsapp_enabled: checked })}
                   />
                 </div>

                 {appConfig.whatsapp_enabled && (
                   <div className="space-y-4">
                     <div className="space-y-2">
                       <Label>Número de WhatsApp</Label>
                       <Input
                         value={appConfig.whatsapp_number || ''}
                         onChange={(e) => setAppConfig({ ...appConfig, whatsapp_number: e.target.value })}
                         placeholder="8615115661301"
                       />
                       <p className="text-xs text-slate-500">Formato: sin +, sin espacios (ej: 584121234567)</p>
                     </div>

                     <div className="space-y-2">
                       <Label>Mensaje por defecto</Label>
                       <Textarea
                         value={appConfig.whatsapp_message || ''}
                         onChange={(e) => setAppConfig({ ...appConfig, whatsapp_message: e.target.value })}
                         placeholder="Hola, necesito ayuda con mi envío"
                         rows={2}
                       />
                     </div>

                     <div className="space-y-2">
                       <Label>Ícono personalizado</Label>
                       <Input
                         type="file"
                         accept="image/*"
                         onChange={(e) => handleWhatsAppIconUpload(e.target.files[0])}
                         disabled={uploadingWhatsAppIcon}
                       />
                       {appConfig.whatsapp_icon_url && (
                         <img src={appConfig.whatsapp_icon_url} alt="WhatsApp Icon" className="h-12 w-12 object-contain rounded border" />
                       )}
                       <p className="text-xs text-slate-500">Deixe em branco para usar o ícone padrão</p>
                     </div>
                   </div>
                 )}
                 </div>

                 {/* Consolidation Periods */}
                 <div className="mt-8 p-4 md:p-6 bg-indigo-50 rounded-xl border border-indigo-200 space-y-4">
                 <div className="flex items-center gap-2 mb-4">
                   <Clock className="h-5 w-5 text-indigo-600" />
                   <h3 className="font-semibold text-slate-800 text-lg">Períodos de Consolidación</h3>
                 </div>
                 <p className="text-sm text-slate-600 mb-4">Configura los períodos (en días) disponibles para que los clientes elijan al solicitar consolidación</p>
                 <div className="space-y-3">
                   {(appConfig.consolidation_periods || [15, 20, 30]).map((period, index) => (
                     <div key={index} className="flex items-center gap-3">
                       <Input
                         type="number"
                         value={period}
                         onChange={(e) => {
                           const newPeriods = [...(appConfig.consolidation_periods || [])];
                           newPeriods[index] = parseInt(e.target.value) || 0;
                           setAppConfig({ ...appConfig, consolidation_periods: newPeriods });
                         }}
                         min="1"
                         placeholder="Días"
                         className="w-32"
                       />
                       <span className="text-sm text-slate-600">días</span>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => {
                           const newPeriods = (appConfig.consolidation_periods || []).filter((_, i) => i !== index);
                           setAppConfig({ ...appConfig, consolidation_periods: newPeriods });
                         }}
                         className="ml-auto"
                       >
                         Eliminar
                       </Button>
                     </div>
                   ))}
                 </div>
                 <Button
                   variant="outline"
                   onClick={() => {
                     const newPeriods = [...(appConfig.consolidation_periods || []), 30];
                     setAppConfig({ ...appConfig, consolidation_periods: newPeriods });
                   }}
                   className="w-full mt-2"
                 >
                   + Agregar período
                 </Button>
                 </div>

                 <Button onClick={handleSaveGeneral} disabled={saving} className="w-full">
                 {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                 Guardar cambios
                 </Button>
                 </CardContent>
                 </Card>
                 </TabsContent>

        <TabsContent value="diseno">
          <DesignPhaseOneStudio />
        </TabsContent>

        {/* Tab Privacidad */}
        <TabsContent value="privacidad">
          <Card className="rounded-2xl border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Privacidad y Gestión de Datos</CardTitle>
              <CardDescription>
                Configura políticas de retención y privacidad de datos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
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
          <PaymentMethodsSettings
            config={appConfig}
            setConfig={setAppConfig}
            saving={saving}
            onSave={handleSaveGeneral}
          />
        </TabsContent>



        <TabsContent value="facturas">
          <Card className="rounded-2xl border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Configuración de Factura
              </CardTitle>
              <CardDescription>
                Personaliza la información que aparece en las facturas PDF
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
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


      <TabsContent value="recursos">
        <ResourceInspector />
      </TabsContent>
      </Tabs>
    </div>
  );
}