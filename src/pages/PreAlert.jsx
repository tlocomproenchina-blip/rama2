import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Package, 
  Plane, 
  Ship, 
  Shield, 
  Upload, 
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useEnabledShippingTypes } from '@/components/ShippingTypeFilter';
import { logActionAudit } from '@/lib/actionAudit';
import ClientPageHero from '@/components/client-portal/ClientPageHero';

export default function PreAlert({ user }) {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const enabledTypes = useEnabledShippingTypes();
  const [formData, setFormData] = useState({
    tracking_number: '',
    shipping_type: '',
    description: '',
    has_insurance: false,
    fob_value: ''
  });
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
    if (configs.length > 0) {
      setConfig(configs[0]);
      // Set default shipping type to first enabled option
      if (!formData.shipping_type) {
        if (configs[0].shipping_type_air_enabled !== false) {
          setFormData(prev => ({ ...prev, shipping_type: 'aereo' }));
        } else if (configs[0].shipping_type_sea_enabled !== false) {
          setFormData(prev => ({ ...prev, shipping_type: 'maritimo' }));
        }
      }
    }
    setLoading(false);
  };

  // Check if user has shipping mark
  const hasShippingMark = user?.shipping_mark && user.shipping_mark.length > 0;

  const validateTracking = async (tracking) => {
    const existing = await base44.entities.Package.filter({ tracking_number: tracking });
    return existing.length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = {};
    
    if (!formData.tracking_number.trim()) {
      newErrors.tracking_number = 'Tracking requerido';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Descripción requerida';
    }

    if (formData.has_insurance && !formData.fob_value) {
      newErrors.fob_value = 'Valor FOB requerido para seguro';
    }

    if (formData.has_insurance && !invoiceFile) {
      newErrors.invoice_file = 'La factura es obligatoria cuando el envío está asegurado';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);

    // Validate tracking duplicates
    const isUnique = await validateTracking(formData.tracking_number);
    if (!isUnique) {
      setErrors({ tracking_number: 'Este número de tracking ya ha sido registrado' });
      setSaving(false);
      return;
    }

    try {
      let invoiceUrl = null;
      
      // Upload file first if exists
      if (invoiceFile) {
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: invoiceFile });
          invoiceUrl = file_url;
        } catch (uploadError) {
          toast.error('Error al subir el archivo. Por favor intenta nuevamente.');
          setSaving(false);
          return;
        }
      }

      // Create package
      const newPackage = await base44.entities.Package.create({
        tracking_number: formData.tracking_number,
        client_email: user.email,
        shipping_mark: user.shipping_mark,
        shipping_type: formData.shipping_type,
        description: formData.description,
        has_insurance: formData.has_insurance,
        fob_value: formData.has_insurance ? parseFloat(formData.fob_value) : null,
        invoice_url: invoiceUrl,
        status: 'pre_alerta'
      });

      await logActionAudit(base44, user, {
        target_email: user?.email,
        target_name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email,
        action_type: 'report_prealert',
        module_name: 'PreAlert',
        reference_id: newPackage.id,
        area_name: 'Operaciones',
        summary: `Reportó pre-alerta ${formData.tracking_number}`,
        details: `Tipo: ${formData.shipping_type} · Descripción: ${formData.description}${formData.has_insurance ? ` · Asegurado FOB $${formData.fob_value}` : ''}`,
        changed_fields: ['tracking_number', 'shipping_type', 'description', 'has_insurance'],
      });

      // Notify admins
      const isHighValue = formData.has_insurance && parseFloat(formData.fob_value) >= 500;
      import('@/components/NotificationUtils').then(({ notifyAdmins }) => {
        notifyAdmins({
          subject: `${isHighValue ? '⚠️ ' : ''}📦 Nueva Pre-alerta${formData.has_insurance ? ' (Asegurada)' : ''}${isHighValue ? ' - ALTO VALOR' : ''}`,
          body: `Nueva pre-alerta registrada:\n\nTracking: ${formData.tracking_number}\nCliente: ${user.first_name || ''} ${user.last_name || ''} (${user.email})\nShipping Mark: ${user.shipping_mark}\nTipo: ${formData.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}\nDescripción: ${formData.description}${formData.has_insurance ? `\n\n🛡️ PAQUETE ASEGURADO${isHighValue ? ' - ALTO VALOR' : ''}\nValor FOB: $${formData.fob_value}` : ''}`,
          title: formData.has_insurance ? `🛡️ Pre-alerta Asegurada${isHighValue ? ' (ALTO VALOR)' : ''}` : '📦 Nueva Pre-alerta',
          message: `${user.first_name || user.email}: ${formData.tracking_number}${formData.has_insurance ? ` - Asegurado $${formData.fob_value}` : ''}`,
          type: 'package',
          icon: formData.has_insurance ? 'alert' : 'package',
          referenceId: newPackage.id
        });
      });

      toast.success('Pre-alerta creada exitosamente');
      navigate(createPageUrl('MyPackages'));
    } catch (error) {
      console.error('Error creating pre-alert:', error);
      toast.error('Error al crear la pre-alerta. Por favor intenta nuevamente.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!hasShippingMark) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-amber-200/70 bg-amber-50/90 shadow-card">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-amber-500" />
            <h2 className="text-xl font-semibold text-amber-800 mb-2">
              Shipping Mark Requerido
            </h2>
            <p className="text-amber-700">
              Necesitas tener un Shipping Mark asignado para poder crear pre-alertas.
              Un administrador te lo asignará pronto.
            </p>
            <Button 
              variant="outline" 
              className="mt-6"
              onClick={() => navigate(createPageUrl('Dashboard'))}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ClientPageHero
        icon={Package}
        eyebrow="Gestión de envíos"
        title="Nueva Pre-alerta"
        description="Registra tu paquete antes de enviarlo con un flujo más claro y ordenado."
        badges={[formData.shipping_type === 'maritimo' ? 'Marítimo' : 'Aéreo', formData.has_insurance ? 'Con seguro' : 'Sin seguro']}
        action={
          <Button variant="outline" onClick={() => navigate(createPageUrl('Dashboard'))}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        }
        aside={
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Shipping Mark</p>
            <div className="rounded-2xl bg-slate-100/90 px-3 py-2 font-mono text-sm font-semibold text-slate-700">
              {user?.shipping_mark}
            </div>
            <p className="text-sm text-muted-foreground">Periodo de consolidación estimado: {config?.consolidation_periods?.[0] || 30} días.</p>
          </div>
        }
      />

      <Card className="border-indigo-200/70 bg-indigo-50/90 shadow-card">
        <CardContent className="p-5 flex items-start gap-4">
          <Clock className="h-6 w-6 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-indigo-900 text-sm mb-1">Información de Consolidación</h3>
            <p className="text-indigo-800 text-sm leading-relaxed">
              Una vez recibido tu primer paquete, contarás con <span className="font-bold">{config?.consolidation_periods?.[0] || 30} días</span> para solicitar la consolidación. 
              De lo contrario, realizaremos una consolidación automática con los paquetes disponibles en depósito. El envío mínimo es de 0.130 CBM o el equivalente a una caja de 50cm × 50cm × 50cm.
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardContent className="p-6 space-y-6">
            {/* Tracking Number */}
            <div className="space-y-2">
              <Label htmlFor="tracking" className="text-slate-700 font-medium">
                Número de Tracking *
              </Label>
              <Input
                id="tracking"
                value={formData.tracking_number}
                onChange={(e) => {
                  setFormData({ ...formData, tracking_number: e.target.value });
                  setErrors({ ...errors, tracking_number: null });
                }}
                placeholder="Ingresa el número de tracking"
                className={errors.tracking_number ? 'border-red-300' : ''}
              />
              {errors.tracking_number && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.tracking_number}
                </p>
              )}
            </div>

            {/* Shipping Type */}
            <div className="space-y-3">
              <Label className="text-slate-700 font-medium">Tipo de Envío *</Label>
              <RadioGroup 
                value={formData.shipping_type} 
                onValueChange={(val) => setFormData({ ...formData, shipping_type: val })}
                className={`grid ${config?.shipping_type_air_enabled !== false && config?.shipping_type_sea_enabled !== false ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}
              >
                {config?.shipping_type_air_enabled !== false && (
                  <div className={`flex items-center space-x-3 border rounded-xl p-4 cursor-pointer transition-all ${
                    formData.shipping_type === 'aereo' 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <RadioGroupItem value="aereo" id="aereo" />
                    <Label htmlFor="aereo" className="cursor-pointer flex items-center gap-2">
                      <Plane className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Aéreo</span>
                    </Label>
                  </div>
                )}
                {config?.shipping_type_sea_enabled !== false && (
                  <div className={`flex items-center space-x-3 border rounded-xl p-4 cursor-pointer transition-all ${
                    formData.shipping_type === 'maritimo' 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <RadioGroupItem value="maritimo" id="maritimo" />
                    <Label htmlFor="maritimo" className="cursor-pointer flex items-center gap-2">
                      <Ship className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Marítimo</span>
                    </Label>
                  </div>
                )}
              </RadioGroup>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-slate-700 font-medium">
                Descripción *
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  setErrors({ ...errors, description: null });
                }}
                placeholder="Describe el contenido de tu paquete"
                rows={3}
                className={errors.description ? 'border-red-300' : ''}
              />
              {errors.description && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.description}
                </p>
              )}
            </div>

            {/* Insurance Section */}
            <div className="border-t border-slate-100 pt-6">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="insurance"
                  checked={formData.has_insurance}
                  onCheckedChange={(checked) => {
                    setFormData({ ...formData, has_insurance: checked });
                    if (!checked) {
                      setErrors(prev => ({ ...prev, fob_value: null, invoice_file: null }));
                    }
                  }}
                />
                <div className="space-y-1">
                  <Label htmlFor="insurance" className="cursor-pointer font-medium text-slate-700 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    Deseo asegurar este envío
                  </Label>
                  <p className="text-sm text-slate-500">
                    La carga será asegurada por {config?.insurance_percentage || 5}% del valor FOB
                  </p>
                </div>
              </div>

              {formData.has_insurance && (
                <div className="mt-4 space-y-4 pl-7">
                  <div className="space-y-2">
                    <Label htmlFor="fob" className="text-slate-700 font-medium">
                      Valor FOB (USD) *
                    </Label>
                    <Input
                      id="fob"
                      type="number"
                      step="0.01"
                      value={formData.fob_value}
                      onChange={(e) => {
                        setFormData({ ...formData, fob_value: e.target.value });
                        setErrors({ ...errors, fob_value: null });
                      }}
                      placeholder="0.00"
                      className={errors.fob_value ? 'border-red-300' : ''}
                    />
                    {errors.fob_value && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errors.fob_value}
                      </p>
                    )}
                    {formData.fob_value && (
                      <p className="text-sm text-emerald-600">
                        Costo del seguro: ${(parseFloat(formData.fob_value) * (config?.insurance_percentage || 5) / 100).toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      {`Factura (PDF o imagen)${formData.has_insurance ? ' *' : ''}`}
                    </Label>
                    <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${errors.invoice_file ? 'border-red-300 hover:border-red-400' : 'border-slate-200 hover:border-blue-400'}`}>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => { const f = e.target.files?.[0] || null; setInvoiceFile(f); if (f) setErrors(prev => ({ ...prev, invoice_file: null })); }}
                        className="hidden"
                        id="invoice-upload"
                      />
                      <label htmlFor="invoice-upload" className="cursor-pointer">
                        {invoiceFile ? (
                          <div className="flex items-center justify-center gap-2 text-emerald-600">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">{invoiceFile.name}</span>
                          </div>
                        ) : (
                          <div className="text-slate-500">
                            <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                            <p className="text-sm">Click para subir la factura</p>
                          </div>
                        )}
                      </label>
                    </div>
                    {errors.invoice_file && (
                      <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-4 w-4" />
                        {errors.invoice_file}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 mt-6">
          <Button 
            type="button" 
            variant="outline" 
            className="flex-1"
            onClick={() => navigate(createPageUrl('Dashboard'))}
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={saving}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Crear Pre-alerta
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}