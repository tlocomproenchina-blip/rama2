import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from '@/components/api/ApiQueueManager';
import { MapPin, Phone, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function EditProfileModal({ open, onClose, user, onUpdate }) {
  const [formData, setFormData] = useState({
    city: '',
    whatsapp: ''
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [config, setConfig] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        setConfig(configs[0]);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  useEffect(() => {
    if (user && open) {
      setFormData({
        city: user.city || '',
        whatsapp: user.whatsapp || ''
      });
      setErrors({});
    }
  }, [user, open]);

  const validate = () => {
    const newErrors = {};
    if (!formData.city?.trim()) newErrors.city = 'Ciudad requerida';
    if (!formData.whatsapp?.trim()) newErrors.whatsapp = 'WhatsApp requerido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    
    setSaving(true);
    try {
      await base44.auth.updateMe(formData);
      toast.success('✅ Datos actualizados correctamente');
      onUpdate();
      onClose();
    } catch (error) {
      toast.error('Error al actualizar');
    }
    setSaving(false);
  };

  if (config?.allow_profile_updates === false) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              Actualización de Datos No Disponible
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">
              Momentáneamente no es posible actualizar tu información de perfil. Por favor intenta más tarde.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-blue-600" />
            </div>
            Editar Información de Contacto
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="city" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Ciudad de Entrega
            </Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => {
                setFormData({ ...formData, city: e.target.value });
                setErrors({ ...errors, city: null });
              }}
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
            <Label htmlFor="whatsapp" className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> WhatsApp
            </Label>
            <Input
              id="whatsapp"
              value={formData.whatsapp}
              onChange={(e) => {
                setFormData({ ...formData, whatsapp: e.target.value });
                setErrors({ ...errors, whatsapp: null });
              }}
              placeholder="+58 412 1234567"
              className={errors.whatsapp ? 'border-red-300' : ''}
            />
            {errors.whatsapp && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.whatsapp}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}