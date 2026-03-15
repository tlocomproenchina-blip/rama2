import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizeStates, findStateByCodeOrName } from '@/components/utils/states';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, MapPin, Phone, Save, Loader2, DollarSign, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Profile({ user, refreshUser }) {
  const [formData, setFormData] = useState({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      cedula: user?.cedula || '',
      whatsapp: user?.whatsapp || '',
      state: user?.state || '',
      city: user?.city || '',
      address: user?.address || ''
    });
  const [saving, setSaving] = useState(false);
  const [stateConfigs, setStateConfigs] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [appConfig, setAppConfig] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const getMissingFields = () => {
    const missing = [];
    if (!user?.first_name) missing.push('first_name');
    if (!user?.last_name) missing.push('last_name');
    if (!user?.cedula) missing.push('cedula');
    if (!user?.whatsapp) missing.push('whatsapp');
    if (!user?.state) missing.push('state');
    if (!user?.city) missing.push('city');
    return missing;
  };

  const missingFields = getMissingFields();
  const hasMissingFields = missingFields.length > 0;
  const profileUpdatesDisabled = appConfig?.allow_profile_updates === false ? true : false;

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        cedula: user.cedula || '',
        whatsapp: user.whatsapp || '',
        state: user.state || '',
        city: user.city || '',
        address: user.address || ''
      });
    }
  }, [user?.id]);

  const loadConfigs = async () => {
    try {
      const states = await base44.entities.StateConfig.filter({ is_active: true });
      const normalized = normalizeStates(states);
      setStateConfigs(normalized);
      // Alinear el valor del usuario (código o nombre) al código esperado por el Select
      if (user?.state) {
        const match = findStateByCodeOrName(normalized, user.state);
        if (match) {
          setFormData((prev) => ({ ...prev, state: match.state_code }));
        }
      }
      
      const pricing = await base44.entities.PricingConfig.filter({ config_key: 'main' });
      if (pricing.length > 0) {
        setPricingConfig(pricing[0]);
      }

      const config = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (config.length > 0) {
        setAppConfig(config[0]);
      }
    } catch (error) {
      console.error('Error loading configs:', error);
    }
  };

  const calculatePricing = () => {
    if (!formData.state || !pricingConfig) return null;

    // Buscar por código o por nombre (para compatibilidad con datos antiguos)
    const stateConfig = findStateByCodeOrName(stateConfigs, formData.state);
    if (!stateConfig) return null;

    const stateRate = Number(stateConfig.shipping_rate) || 0;
    const doorToDoor = Number(pricingConfig.door_to_door_cost) || 0;
    const benefitPercent = Number(pricingConfig.profit_percentage) || 0;

    const regularBase = Number(pricingConfig.base_rate_regular) || 0;
    const regularPrice = (regularBase * (1 + benefitPercent / 100)) + stateRate + doorToDoor;

    const highRiskBase = Number(pricingConfig.base_rate_high_risk) || 0;
    const highRiskPrice = (highRiskBase * (1 + benefitPercent / 100)) + stateRate + doorToDoor;

    return {
      regular: regularPrice.toFixed(2),
      highRisk: highRiskPrice.toFixed(2),
      stateName: stateConfig.state_name
    };
  };

  // Normalizador de WhatsApp a dígitos
  const getDigits = (s) => (s || '').replace(/\D/g, '');
  
  // Permitir solo dígitos y un '+' opcional al inicio
  const sanitizeWhatsApp = (v) => {
    let s = String(v || '').replace(/[^\d+]/g, '');
    if (s.startsWith('+')) {
      s = '+' + s.slice(1).replace(/[+]/g, '');
    } else {
      s = s.replace(/[+]/g, '');
    }
    return s;
  };

  // Cierra overlays de Radix (Select/Popover) antes de desmontar/cerrar
  const closeRadixOverlays = () => {
    try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); } catch {}
  };

  useEffect(() => {
    return () => { closeRadixOverlays(); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones
    if (!formData.first_name || !formData.last_name) {
      toast.error('Nombre y apellido son obligatorios');
      return;
    }

    if (!formData.cedula) {
      toast.error('La cédula es obligatoria');
      return;
    }


    if (!formData.whatsapp) {
      toast.error('El WhatsApp es obligatorio');
      return;
    }

    if (!formData.state) {
      toast.error('El estado es obligatorio');
      return;
    }

    if (!formData.city) {
      toast.error('La ciudad es obligatoria');
      return;
    }

    // Verificar duplicados por WhatsApp (normalizado), permitiendo el propio usuario
    try {
      const { data } = await base44.functions.invoke('checkWhatsappUnique', {
        whatsapp: formData.whatsapp,
        current_user_id: user?.id
      });
      if (!data?.unique) {
        toast.error('Ese número de WhatsApp ya está registrado por otro cliente');
        return;
      }
    } catch (e) {
      console.error('checkWhatsappUnique error', e);
      // Continuar para no bloquear por errores transitorios
    }

    setSaving(true);
    
    try {
       await base44.auth.updateMe({ ...formData, whatsapp_normalized: getDigits(formData.whatsapp) });
       // En apps antiguas, podría no existir el campo. Este update lo persistirá si está permitido
       

       setShowSuccess(true);
       setTimeout(() => setShowSuccess(false), 3000);

       if (refreshUser) {
         await refreshUser();
       }

       toast.success('✓ Perfil actualizado exitosamente');
     } catch (error) {
       console.error('Error updating profile:', error);
       toast.error('Error al actualizar el perfil: ' + (error.message || 'Error desconocido'));
     } finally {
       setSaving(false);
     }
  };

  const isFieldDisabled = (fieldName) => {
    // Si el admin habilitó la actualización de perfil, todos los campos editables
    if (appConfig?.allow_profile_updates === true) {
      return false;
    }
    // Si hay campos faltantes, solo habilitar los que faltan (onboarding)
    if (hasMissingFields) {
      return !missingFields.includes(fieldName);
    }
    // Caso contrario, respeta la configuración global
    return profileUpdatesDisabled;
  };

  const pricingInfo = calculatePricing();
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-xl">
            <User className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Mi Perfil</h1>
            <p className="text-blue-100">Actualiza tu información personal</p>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Información Personal
          </CardTitle>
          <CardDescription>
            Mantén tu información actualizada para un mejor servicio
          </CardDescription>
          {hasMissingFields && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                ℹ️ Por favor completa los datos faltantes para finalizar tu registro.
              </p>
            </div>
          )}
          {!hasMissingFields && profileUpdatesDisabled && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800">
                ⚠️ <strong>Actualización de perfil deshabilitada</strong> - crea un ticket en soporte para actualizar tus datos.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre y Apellido */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre *</Label>
                <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="Tu nombre"
                    disabled={isFieldDisabled('first_name')}
                    required
                  />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Tu apellido"
                  disabled={isFieldDisabled('last_name')}
                  required
                />
              </div>
            </div>

            {/* Cédula */}
            <div className="space-y-2">
              <Label htmlFor="cedula">NUMERO DE CEDULA *</Label>
              <Input
                id="cedula"
                value={formData.cedula}
                onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                placeholder="V-12345678"
                disabled={isFieldDisabled('cedula')}
                required
              />
            </div>

            {/* WhatsApp */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  WhatsApp *
                </Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: sanitizeWhatsApp(e.target.value) })}
                  placeholder="+58 414 1234567"
                  inputMode="tel"
                  pattern="^\\+?\\d*$"
                  disabled={isFieldDisabled('whatsapp')}
                  required
                />
              </div>
            </div>

            {/* Ubicación */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="state" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Estado *
                </Label>
                <Select 
                  value={formData.state}
                  onValueChange={(value) => setFormData({ ...formData, state: value })}
                  disabled={isFieldDisabled('state')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tu estado" />
                  </SelectTrigger>
                  <SelectContent>
                     {stateConfigs.map((state) => (
                       <SelectItem key={state.state_code} value={state.state_code}>
                         {state.state_name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                </Select>
                {pricingInfo && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-semibold text-blue-900">Precios de envío para {pricingInfo.stateName}</p>
                    </div>
                    <div className="space-y-1 text-xs text-blue-800">
                      <p>• Carga Regular: <span className="font-bold">${pricingInfo.regular}</span></p>
                      <p>• Carga Alto Riesgo: <span className="font-bold">${pricingInfo.highRisk}</span></p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="city" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Ciudad *
                </Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Tu ciudad"
                  disabled={isFieldDisabled('city')}
                  required
                />
              </div>
            </div>

            {/* Dirección */}
            <div className="space-y-2">
              <Label htmlFor="address">Dirección Completa</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Calle, número, edificio, apartamento, referencias..."
                disabled={isFieldDisabled('address')}
                rows={3}
              />
              <p className="text-xs text-slate-500">
                Opcional: Esta información es útil para entregas a domicilio
              </p>
            </div>

            {/* Submit Button */}
             <div className="relative">
               <Button 
                 type="submit" 
                 disabled={saving}
                 className="w-full bg-blue-600 hover:bg-blue-700"
               >
                 {saving ? (
                   <>
                     <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                     Guardando...
                   </>
                 ) : (
                   <>
                     <Save className="h-4 w-4 mr-2" />
                     Guardar Cambios
                   </>
                 )}
               </Button>
               {showSuccess && (
                 <div className="absolute top-full mt-2 left-0 right-0 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 animate-in fade-in zoom-in-95">
                   <CheckCircle2 className="h-5 w-5 text-green-600" />
                   <span className="text-sm font-medium text-green-800">¡Cambios guardados exitosamente!</span>
                 </div>
               )}
             </div>
          </form>
        </CardContent>
      </Card>

      {/* Account Info - Read Only */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-600">Información de Cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-slate-500">Email</Label>
            <p className="text-sm font-medium text-slate-700">{user?.email}</p>
          </div>
          {user?.shipping_mark && (
            <div>
              <Label className="text-xs text-slate-500">Shipping Mark</Label>
              <p className="text-sm font-medium text-slate-700 font-mono">{user.shipping_mark}</p>
            </div>
          )}
          <p className="text-xs text-slate-500 italic">
            Para cambiar tu email o shipping mark, contacta con soporte
          </p>
        </CardContent>
      </Card>
    </div>
  );
}