import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, MapPin, Phone, Loader2, AlertCircle, DollarSign, Home } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { base44 as base44Queue } from '@/components/api/ApiQueueManager';
import { normalizeStates, findStateByCodeOrName } from '@/components/utils/states';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getDigits, sanitizeClientProfileData } from '@/lib/inputSanitizers';
import WhatsAppInput from '@/components/common/WhatsAppInput';

export default function ProfileSetupModal({ open, onComplete }) {
  const [formData, setFormData] = useState({
      first_name: '',
      last_name: '',
      cedula: '',
      state: '',
      city: '',
      whatsapp: '',
      address: ''
    });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [stateConfigs, setStateConfigs] = useState([]);
  const [pricingConfig, setPricingConfig] = useState(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const states = await base44.entities.StateConfig.filter({ is_active: true });
      const normalized = normalizeStates(states);
      setStateConfigs(normalized);
      
      const pricing = await base44.entities.PricingConfig.filter({ config_key: 'main' });
      if (pricing.length > 0) {
        setPricingConfig(pricing[0]);
      }

      // Si el usuario ya tiene un valor guardado (código o nombre), alinear al código
      const me = await base44.auth.me();
      if (me?.state) {
        const match = findStateByCodeOrName(normalized, me.state);
        if (match) setFormData((prev) => ({ ...prev, state: match.state_code }));
      }
    } catch (error) {
      console.error('Error loading configs:', error);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'Nombre requerido';
    if (!formData.last_name.trim()) newErrors.last_name = 'Apellido requerido';
    if (!formData.cedula.trim()) newErrors.cedula = 'Número de cédula requerido';
    if (!formData.state.trim()) newErrors.state = 'Estado requerido';
    if (!formData.city.trim()) newErrors.city = 'Ciudad requerida';
    if (!formData.whatsapp.trim()) newErrors.whatsapp = 'WhatsApp requerido';
    if (!formData.address.trim()) newErrors.address = 'Dirección requerida';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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


  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const me = await base44.auth.me();

      // Verificar duplicados por cédula
      const { data: cedulaCheck } = await base44Queue.functions.invoke('checkDuplicates', {
        action: 'check_field',
        field: 'cedula',
        value: formData.cedula,
        exclude_user_id: me?.id
      });
      if (cedulaCheck?.duplicate) {
        setErrors((prev) => ({ ...prev, cedula: 'Ya existe un cliente registrado con esa cédula' }));
        toast.error('Esa cédula ya está registrada');
        setSaving(false);
        return;
      }

      // Verificar duplicados por WhatsApp
      const { data: waCheck } = await base44.functions.invoke('checkWhatsappUnique', {
        whatsapp: formData.whatsapp,
        current_user_id: me?.id
      });
      if (!waCheck?.unique) {
        setErrors((prev) => ({ ...prev, whatsapp: 'Ya existe un cliente registrado con ese WhatsApp' }));
        toast.error('Ese número de WhatsApp ya está registrado');
        setSaving(false);
        return;
      }

      // Todo limpio, guardar perfil
      const sanitizedProfile = sanitizeClientProfileData(formData);
      const payload = { ...sanitizedProfile, whatsapp_normalized: getDigits(sanitizedProfile.whatsapp) };
      await onComplete(payload);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Error al verificar datos. Intenta de nuevo.');
    }
    setSaving(false);
  };

  const pricingInfo = calculatePricing();
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) base44.auth.logout(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 rounded-xl">
              <User className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-800">
                Completa tu Perfil
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Por favor completa tu perfil para poder asignarte tu Shipping Mark
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4 pb-24">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name" className="text-slate-700">Nombre</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="Tu nombre"
                className={errors.first_name ? 'border-red-300' : ''}
              />
              {errors.first_name && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.first_name}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name" className="text-slate-700">Apellido</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Tu apellido"
                className={errors.last_name ? 'border-red-300' : ''}
              />
              {errors.last_name && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.last_name}
                </p>
              )}
            </div>
          </div>

          {/* Cédula */}
          <div className="space-y-2">
            <Label htmlFor="cedula" className="text-slate-700">NÚMERO DE CÉDULA <span className="text-red-500">*</span></Label>
            <Input
              id="cedula"
              value={formData.cedula}
              onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
              placeholder="V-12345678"
              className={errors.cedula ? 'border-red-300' : ''}
            />
            {errors.cedula && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.cedula}
              </p>
            )}
          </div>

           <div className="space-y-2">
            <Label htmlFor="state" className="text-slate-700 flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Estado
            </Label>
            <Select
              value={formData.state}
              onValueChange={(val) => {
                setFormData((prev) => ({ ...prev, state: val }));
                setErrors((prev) => ({ ...prev, state: null }));
              }}
            >
              <SelectTrigger className={`min-h-[48px] ${errors.state ? 'border-red-300' : 'border-input'}`}>
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
            {errors.state && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.state}
              </p>
            )}
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
            <Label htmlFor="city" className="text-slate-700 flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Ciudad de Entrega
            </Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Ciudad donde recibirás tus paquetes"
              className={errors.city ? 'border-red-300' : ''}
            />
            {errors.city && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.city}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp" className="text-slate-700 flex items-center gap-2">
              <Phone className="h-4 w-4" /> WhatsApp
            </Label>
            <WhatsAppInput
              id="whatsapp"
              value={formData.whatsapp}
              onChange={(val) => {
                setFormData({ ...formData, whatsapp: val });
                setErrors((prev) => ({ ...prev, whatsapp: null }));
              }}
              error={!!errors.whatsapp}
            />
            <p className="text-xs text-slate-500">
              Selecciona el prefijo de tu país e introduce el número sin espacios.
            </p>
            {errors.whatsapp && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.whatsapp}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-slate-700 flex items-center gap-2">
              <Home className="h-4 w-4" /> Dirección Completa
            </Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Calle, número, edificio, apartamento, referencias..."
              rows={3}
              className={errors.address ? 'border-red-300' : ''}
            />
            {errors.address && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.address}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-t border-slate-200">
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
            ) : (
              'Guardar Perfil'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}