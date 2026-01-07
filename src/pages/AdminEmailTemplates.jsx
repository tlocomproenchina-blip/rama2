import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Mail, 
  Save, 
  Eye, 
  Send, 
  Loader2,
  AlertCircle,
  CheckCircle,
  Users,
  CreditCard,
  Package,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';

const defaultTemplates = {
  package_received: {
    subject: '📦 Tu paquete ha sido recibido - TLEC Logistics',
    body: '¡Buenas noticias!\n\nTu paquete con tracking {{tracking_number}} ha sido recibido en nuestro almacén.\n\nPronto será procesado para consolidación.\n\nPuedes verificar el estado en tu panel de cliente.'
  },
  package_in_transit: {
    subject: '✈️ Tu paquete está en tránsito - TLEC Logistics',
    body: 'Tu paquete {{tracking_number}} está en camino.\n\nEstá siendo transportado y pronto llegará a destino.\n\nPuedes seguir el estado en tu panel de cliente.'
  },
  package_available: {
    subject: '📍 Tu paquete está disponible para retiro - TLEC Logistics',
    body: '¡Tu paquete {{tracking_number}} ya está disponible para retiro!\n\nPuedes coordinarlo contactándonos.\n\nRevisa los detalles en tu panel de cliente.'
  },
  package_delivered: {
    subject: '✅ Tu paquete ha sido entregado - TLEC Logistics',
    body: 'Tu paquete {{tracking_number}} ha sido entregado exitosamente.\n\n¡Gracias por confiar en TLEC Logistics!\n\nEsperamos verte pronto.'
  },
  consolidation_created: {
    subject: '📦 Tu carga ha sido consolidada - TLEC Logistics',
    body: '¡Tu carga ha sido consolidada!\n\nNúmero de Consolidación: {{consolidation_tracking}}\nPaquetes incluidos: {{tracking_numbers}}\nCantidad de paquetes: {{package_count}}\n\nDetalles del envío:\n- Tipo: {{shipping_type}}\n- Peso: {{weight}} kg\n- Costo de envío: ${{shipping_cost}}\n- Costo de seguro: ${{insurance_cost}}\n- Total a pagar: ${{total_cost}}\n\n{{#if estimated_delivery}}Fecha estimada de entrega: {{estimated_delivery}}\n\n{{/if}}Por favor ingresa al sistema para realizar el pago y continuar con el proceso de envío.'
  },
  consolidation_in_transit: {
    subject: '✈️ Tu consolidación está en tránsito - TLEC Logistics',
    body: 'Tu consolidación está en camino.\n\nNúmero de Consolidación: {{consolidation_tracking}}\n\nPuedes seguir el estado en tu panel de cliente.'
  },
  consolidation_available: {
    subject: '📍 Tu consolidación está disponible - TLEC Logistics',
    body: '¡Tu consolidación está lista para ser retirada!\n\nNúmero de Consolidación: {{consolidation_tracking}}\n\nContacta con nosotros para coordinar la entrega.'
  },
  consolidation_delivered: {
    subject: '✅ Tu consolidación ha sido entregada - TLEC Logistics',
    body: '¡Tu consolidación ha sido entregada exitosamente!\n\nNúmero de Consolidación: {{consolidation_tracking}}\n\n¡Gracias por confiar en TLEC Logistics! Esperamos verte pronto.'
  },
  payment_validated: {
    subject: '✅ Pago validado - Tu carga está en camino - TLEC Logistics',
    body: '¡Excelente! Tu pago ha sido validado exitosamente.\n\nNúmero de Consolidación: {{consolidation_tracking}}\nMonto pagado: ${{payment_amount}}\nTotal: ${{total_cost}}\n\nTu carga está ahora en tránsito y pronto llegará a destino.\n\nPuedes seguir el estado de tu envío en tu panel de cliente.'
  },
  payment_rejected: {
    subject: '❌ Pago rechazado - Acción requerida - TLEC Logistics',
    body: 'Tu pago no pudo ser validado.\n\nNúmero de Consolidación: {{consolidation_tracking}}\nMonto total: ${{total_cost}}\n\nMotivo del rechazo: {{rejection_reason}}\n\nPor favor verifica la información y vuelve a enviar el comprobante de pago correcto desde tu panel de cliente.'
  },
  admin_new_user: {
    subject: '👤 Nuevo usuario registrado - TLEC Logistics',
    body: 'Un nuevo usuario ha completado su registro:\n\nNombre: {{first_name}} {{last_name}}\nCiudad: {{city}}\nWhatsApp: {{whatsapp}}\nEmail: {{email}}\n\nPor favor asigna un Shipping Mark al usuario.'
  },
  admin_payment_reported: {
    subject: '💳 Nuevo pago reportado - TLEC Logistics',
    body: 'Un cliente ha reportado un pago para la consolidación {{consolidation_tracking}}.\n\nMonto: ${{amount}}\nMétodo: {{payment_method}}\n\nPor favor revisa y valida el pago.'
  },
  admin_insured_shipment: {
    subject: '🛡️ Nuevo envío asegurado - TLEC Logistics',
    body: 'Un cliente ha registrado un envío asegurado:\n\nTracking: {{tracking_number}}\nCliente: {{client_name}}\nEmail: {{client_email}}\nValor FOB: ${{fob_value}}\n\nPor favor revisa la factura adjunta.'
  }
};

const templateCategories = [
  {
    key: 'client',
    label: 'Cliente',
    icon: Users,
    templates: [
      { key: 'package_received', label: 'Paquete Recibido', icon: Package },
      { key: 'package_in_transit', label: 'Paquete en Tránsito', icon: Package },
      { key: 'package_available', label: 'Paquete Disponible', icon: Package },
      { key: 'package_delivered', label: 'Paquete Entregado', icon: Package },
      { key: 'consolidation_created', label: 'Consolidación Creada', icon: Package },
      { key: 'consolidation_in_transit', label: 'Consolidación en Tránsito', icon: Package },
      { key: 'consolidation_available', label: 'Consolidación Disponible', icon: Package },
      { key: 'consolidation_delivered', label: 'Consolidación Entregada', icon: Package },
      { key: 'payment_validated', label: 'Pago Validado', icon: CreditCard },
      { key: 'payment_rejected', label: 'Pago Rechazado', icon: CreditCard }
    ]
  },
  {
    key: 'admin',
    label: 'Administrador',
    icon: Shield,
    templates: [
      { key: 'admin_new_user', label: 'Nuevo Usuario', icon: Users },
      { key: 'admin_payment_reported', label: 'Pago Reportado', icon: CreditCard },
      { key: 'admin_insured_shipment', label: 'Envío Asegurado', icon: Shield }
    ]
  }
];

const variablesHelp = {
  package_received: ['{{tracking_number}}'],
  package_in_transit: ['{{tracking_number}}'],
  package_available: ['{{tracking_number}}'],
  package_delivered: ['{{tracking_number}}'],
  consolidation_created: ['{{consolidation_tracking}}', '{{tracking_numbers}}', '{{package_count}}', '{{shipping_type}}', '{{weight}}', '{{shipping_cost}}', '{{insurance_cost}}', '{{total_cost}}', '{{estimated_delivery}}'],
  consolidation_in_transit: ['{{consolidation_tracking}}'],
  consolidation_available: ['{{consolidation_tracking}}'],
  consolidation_delivered: ['{{consolidation_tracking}}'],
  payment_validated: ['{{consolidation_tracking}}', '{{payment_amount}}', '{{total_cost}}'],
  payment_rejected: ['{{consolidation_tracking}}', '{{total_cost}}', '{{rejection_reason}}'],
  admin_new_user: ['{{first_name}}', '{{last_name}}', '{{city}}', '{{whatsapp}}', '{{email}}'],
  admin_payment_reported: ['{{consolidation_tracking}}', '{{amount}}', '{{payment_method}}'],
  admin_insured_shipment: ['{{tracking_number}}', '{{client_name}}', '{{client_email}}', '{{fob_value}}']
};

export default function AdminEmailTemplates({ user }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('client');
  const [selectedTemplate, setSelectedTemplate] = useState('package_received');
  const [templates, setTemplates] = useState(defaultTemplates);
  const [previewModal, setPreviewModal] = useState(null);
  const [testEmailModal, setTestEmailModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
    if (configs.length > 0) {
      setConfig(configs[0]);
      if (configs[0].email_templates) {
        setTemplates({ ...defaultTemplates, ...configs[0].email_templates });
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config) {
        await base44.entities.AppConfig.update(config.id, {
          email_templates: templates
        });
      } else {
        await base44.entities.AppConfig.create({
          config_key: 'main',
          email_templates: templates
        });
      }
      toast.success('Plantillas guardadas exitosamente');
      loadConfig();
    } catch (error) {
      toast.error('Error al guardar plantillas');
    }
    setSaving(false);
  };

  const handleTemplateChange = (key, field, value) => {
    setTemplates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const handlePreview = (templateKey) => {
    setPreviewModal(templates[templateKey]);
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error('Ingresa un email');
      return;
    }

    setSendingTest(true);
    try {
      const template = templates[selectedTemplate];
      await base44.integrations.Core.SendEmail({
        to: testEmail,
        subject: `[PRUEBA] ${template.subject}`,
        body: `=== EMAIL DE PRUEBA ===\n\n${template.body}\n\n=== FIN DEL EMAIL DE PRUEBA ===\n\nNota: Las variables como {{tracking_number}} serán reemplazadas con valores reales en emails de producción.`
      });
      toast.success('Email de prueba enviado');
      setTestEmailModal(false);
      setTestEmail('');
    } catch (error) {
      toast.error('Error al enviar email de prueba');
    }
    setSendingTest(false);
  };

  const handleResetTemplate = () => {
    setTemplates(prev => ({
      ...prev,
      [selectedTemplate]: defaultTemplates[selectedTemplate]
    }));
    toast.success('Plantilla restaurada a valores por defecto');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const currentTemplate = templates[selectedTemplate] || defaultTemplates[selectedTemplate];
  const currentVariables = variablesHelp[selectedTemplate] || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Plantillas de Email</h1>
        <p className="text-slate-500">Personaliza las notificaciones automáticas por email</p>
      </div>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Acerca de las plantillas</p>
              <p>Usa variables como <code className="bg-blue-100 px-1.5 py-0.5 rounded">{'{{tracking_number}}'}</code> que serán reemplazadas automáticamente con los datos reales al enviar el email.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="grid w-full grid-cols-2">
              {templateCategories.map(cat => {
                const Icon = cat.icon;
                return (
                  <TabsTrigger key={cat.key} value={cat.key}>
                    <Icon className="h-4 w-4 mr-2" />
                    {cat.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {templateCategories
                  .find(c => c.key === selectedCategory)
                  ?.templates.map(template => {
                    const Icon = template.icon;
                    return (
                      <button
                        key={template.key}
                        onClick={() => setSelectedTemplate(template.key)}
                        className={`w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                          selectedTemplate === template.key ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${selectedTemplate === template.key ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className={`text-sm ${selectedTemplate === template.key ? 'font-medium text-blue-900' : 'text-slate-700'}`}>
                          {template.label}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Editor */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  {templateCategories
                    .find(c => c.key === selectedCategory)
                    ?.templates.find(t => t.key === selectedTemplate)?.label}
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handlePreview(selectedTemplate)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Previsualizar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setTestEmailModal(true)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Prueba
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject">Asunto del Email</Label>
                <Input
                  id="subject"
                  value={currentTemplate.subject}
                  onChange={(e) => handleTemplateChange(selectedTemplate, 'subject', e.target.value)}
                  placeholder="Asunto del email"
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label htmlFor="body">Contenido del Email</Label>
                <Textarea
                  id="body"
                  value={currentTemplate.body}
                  onChange={(e) => handleTemplateChange(selectedTemplate, 'body', e.target.value)}
                  placeholder="Contenido del email"
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              {/* Variables Help */}
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Variables disponibles:</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentVariables.map(variable => (
                      <code 
                        key={variable}
                        className="bg-white px-2 py-1 rounded text-xs text-slate-700 border border-slate-200"
                      >
                        {variable}
                      </code>
                    ))}
                  </div>
                  {currentVariables.length === 0 && (
                    <p className="text-sm text-slate-500">No hay variables disponibles para esta plantilla</p>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t border-slate-100">
                <Button 
                  variant="outline"
                  onClick={handleResetTemplate}
                >
                  Restaurar Valores por Defecto
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewModal} onOpenChange={() => setPreviewModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Previsualización
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">ASUNTO</Label>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-medium text-slate-800">{previewModal?.subject}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">CONTENIDO</Label>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans">
                  {previewModal?.body}
                </pre>
              </div>
            </div>
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-3">
                <p className="text-xs text-amber-800">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  Las variables como {'{{tracking_number}}'} serán reemplazadas con valores reales al enviar.
                </p>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Email Modal */}
      <Dialog open={testEmailModal} onOpenChange={() => setTestEmailModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Enviar Email de Prueba
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Email de destino</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-3">
                <p className="text-xs text-blue-800">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  Se enviará con el prefijo [PRUEBA] y las variables no serán reemplazadas.
                </p>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSendTest}
              disabled={sendingTest || !testEmail}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {sendingTest ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar Prueba
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}