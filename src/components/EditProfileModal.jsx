import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from '@/api/base44Client';
import { MapPin, Phone, Loader2, AlertCircle, CheckCircle, Bell } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';

export default function EditProfileModal({ open, onClose, user, onUpdate }) {
  const [formData, setFormData] = useState({
    city: '',
    whatsapp: '',
    email_notifications_enabled: true
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user && open) {
      setFormData({
        city: user.city || '',
        whatsapp: user.whatsapp || '',
        email_notifications_enabled: user.email_notifications_enabled !== false
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

          <div className="space-y-3 pt-4 border-t border-slate-100">
            <Label className="flex items-center gap-2 text-base font-medium">
              <Bell className="h-4 w-4" />
              Notificaciones
            </Label>
            <div className="flex items-start space-x-3">
              <Checkbox
                id="notifications"
                checked={formData.email_notifications_enabled}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, email_notifications_enabled: checked })
                }
              />
              <div className="space-y-1">
                <Label 
                  htmlFor="notifications" 
                  className="cursor-pointer font-normal text-slate-700"
                >
                  Recibir notificaciones por email
                </Label>
                <p className="text-xs text-slate-500">
                  Te notificaremos sobre cambios de estado de tus paquetes y consolidaciones
                </p>
              </div>
            </div>
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