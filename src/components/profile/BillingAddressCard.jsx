import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FileText, Upload, Loader2, CheckCircle, AlertCircle, MapPin, Phone, IdCard, User as UserIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';
import { toast } from 'sonner';
import WhatsAppInput from '@/components/common/WhatsAppInput';

export default function BillingAddressCard({ user, onSaved }) {
  const [useRegistration, setUseRegistration] = useState(user?.billing_use_registration !== false);
  const [formData, setFormData] = useState({
    billing_name: '',
    billing_cedula_rif: '',
    billing_phone: '',
    billing_address: ''
  });
  const [rifImage, setRifImage] = useState(null);
  const [rifImageUrl, setRifImageUrl] = useState('');
  const [uploadingRif, setUploadingRif] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUseRegistration(user?.billing_use_registration !== false);
    setFormData({
      billing_name: user?.billing_name || '',
      billing_cedula_rif: user?.billing_cedula_rif || '',
      billing_phone: user?.billing_phone || '',
      billing_address: user?.billing_address || ''
    });
    setRifImageUrl(user?.billing_rif_image_url || '');
    setRifImage(null);
  }, [user?.id, user?.billing_use_registration]);

  const handleRifUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRifImage(file);
    setUploadingRif(true);
    try {
      const url = await uploadImageNoCredits(file);
      setRifImageUrl(url);
      toast.success('Imagen del RIF subida');
    } catch (err) {
      console.error('RIF upload error:', err);
      toast.error('No se pudo subir la imagen del RIF');
      setRifImage(null);
    } finally {
      setUploadingRif(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        billing_use_registration: useRegistration,
        billing_name: useRegistration ? '' : formData.billing_name,
        billing_cedula_rif: useRegistration ? '' : formData.billing_cedula_rif,
        billing_phone: useRegistration ? '' : formData.billing_phone,
        billing_address: useRegistration ? '' : formData.billing_address,
        billing_rif_image_url: useRegistration ? '' : rifImageUrl
      };

      if (!useRegistration) {
        if (!payload.billing_name?.trim()) {
          toast.error('El nombre/razón social de facturación es obligatorio');
          setSaving(false);
          return;
        }
        if (!payload.billing_cedula_rif?.trim()) {
          toast.error('La cédula o RIF de facturación es obligatorio');
          setSaving(false);
          return;
        }
        if (!payload.billing_phone?.trim()) {
          toast.error('El teléfono de facturación es obligatorio');
          setSaving(false);
          return;
        }
        if (!payload.billing_address?.trim()) {
          toast.error('La dirección de facturación es obligatoria');
          setSaving(false);
          return;
        }
        if (!payload.billing_rif_image_url) {
          toast.error('Debes subir la imagen del RIF');
          setSaving(false);
          return;
        }
      }

      await base44.auth.updateMe(payload);
      toast.success('✅ Dirección de facturación guardada');
      if (onSaved) onSaved();
    } catch (error) {
      console.error('Error saving billing address:', error);
      toast.error('Error al guardar la dirección de facturación');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/70 bg-card/95 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Dirección de Facturación
        </CardTitle>
        <CardDescription>
          Define los datos que aparecerán en tus facturas. Puedes usar los mismos de tu registro o una dirección diferente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Toggle: usar dirección de registro */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="space-y-1">
            <Label htmlFor="billing-toggle" className="font-medium text-slate-700">
              Usar mi dirección de registro
            </Label>
            <p className="text-xs text-slate-500">
              {useRegistration
                ? 'Tus facturas usarán los datos de tu perfil (nombre, cédula, teléfono, dirección).'
                : 'Se usarán los datos de facturación personalizados que ingreses abajo.'}
            </p>
          </div>
          <Switch
            id="billing-toggle"
            checked={useRegistration}
            onCheckedChange={setUseRegistration}
          />
        </div>

        {/* Resumen de datos de registro cuando el toggle está activo */}
        {useRegistration && (
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-1.5">
            <p className="text-sm font-semibold text-blue-900 mb-1">Datos que se usarán en facturas:</p>
            <p className="text-sm text-blue-800">
              <span className="font-medium">Nombre:</span> {user?.first_name || ''} {user?.last_name || ''}
            </p>
            <p className="text-sm text-blue-800">
              <span className="font-medium">Cédula:</span> {user?.cedula || '—'}
            </p>
            <p className="text-sm text-blue-800">
              <span className="font-medium">Teléfono:</span> {user?.whatsapp || '—'}
            </p>
            <p className="text-sm text-blue-800">
              <span className="font-medium">Dirección:</span> {user?.address || user?.city || '—'}
            </p>
          </div>
        )}

        {/* Formulario de dirección diferente */}
        {!useRegistration && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="billing_name" className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4" /> Nombre / Razón Social *
                </Label>
                <Input
                  id="billing_name"
                  value={formData.billing_name}
                  onChange={(e) => setFormData({ ...formData, billing_name: e.target.value })}
                  placeholder="Nombre o empresa para facturar"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing_cedula_rif" className="flex items-center gap-2">
                  <IdCard className="h-4 w-4" /> Cédula o RIF *
                </Label>
                <Input
                  id="billing_cedula_rif"
                  value={formData.billing_cedula_rif}
                  onChange={(e) => setFormData({ ...formData, billing_cedula_rif: e.target.value })}
                  placeholder="Ej: V-12345678 o J-12345678-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Teléfono *
              </Label>
              <WhatsAppInput
                id="billing_phone"
                value={formData.billing_phone}
                onChange={(val) => setFormData({ ...formData, billing_phone: val })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_address" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Dirección Exacta *
              </Label>
              <Textarea
                id="billing_address"
                value={formData.billing_address}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                placeholder="Calle, número, edificio, apartamento, ciudad, referencias..."
                rows={3}
              />
            </div>

            {/* Cargar imagen del RIF */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Imagen del RIF *
              </Label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleRifUpload}
                  className="hidden"
                  id="rif-upload"
                  disabled={uploadingRif}
                />
                <label htmlFor="rif-upload" className={uploadingRif ? 'cursor-wait' : 'cursor-pointer'}>
                  {uploadingRif ? (
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-medium">Subiendo...</span>
                    </div>
                  ) : rifImageUrl ? (
                    <div className="space-y-2">
                      {rifImage && (
                        <img
                          src={URL.createObjectURL(rifImage)}
                          alt="RIF"
                          className="max-h-32 mx-auto rounded-lg object-contain"
                        />
                      )}
                      <div className="flex items-center justify-center gap-2 text-emerald-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">RIF cargado</span>
                      </div>
                      <p className="text-xs text-slate-500">Click para reemplazar</p>
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm">Click para subir la imagen del RIF</p>
                      <p className="text-xs text-slate-400 mt-1">JPG, PNG o similar</p>
                    </div>
                  )}
                </label>
              </div>
              {rifImageUrl && !rifImage && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Ya tienes un RIF cargado. Puedes reemplazarlo arriba.
                </p>
              )}
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-xs text-amber-800 flex items-start gap-1.5">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                Todos los campos son obligatorios para usar una dirección de facturación diferente.
              </p>
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving || uploadingRif} className="w-full bg-blue-600 hover:bg-blue-700">
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
          ) : (
            <><FileText className="h-4 w-4 mr-2" /> Guardar Dirección de Facturación</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}