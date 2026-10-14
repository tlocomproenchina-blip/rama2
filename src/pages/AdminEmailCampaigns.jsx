import React, { useState, useEffect, useMemo, lazy, Suspense, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import 'react-quill/dist/quill.snow.css';

const ReactQuill = lazy(() => import('react-quill'));
import { 
  Mail, 
  Send, 
  Users, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Tag,
  Clock,
  Search,
  Paperclip,
  X,
  Image as ImageIcon,
  Upload,
  History,
  TrendingUp,
  MousePointer
} from 'lucide-react';
import EmailHistoryModal from '@/components/admin/EmailHistoryModal';
import EmailAIAssistant from '@/components/admin/EmailAIAssistant';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { replaceEmailVariables } from '@/components/EmailVariableReplacer';
import { getEmailQueueStats } from '@/components/NotificationUtils';
import { logActionAudit } from '@/lib/actionAudit';
import { fetchAllPaginated } from '@/lib/fetchAllPaginated';

export default function AdminEmailCampaigns({ user }) {
  const [clients, setClients] = useState([]);
  const [packages, setPackages] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [targetType, setTargetType] = useState('all');
  const [selectedClients, setSelectedClients] = useState([]);
  const [emailData, setEmailData] = useState({
    subject: '',
    body: '',
    fromName: ''
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showHtmlInput, setShowHtmlInput] = useState(false);
  const [htmlCode, setHtmlCode] = useState('');
  const [historyModal, setHistoryModal] = useState({ open: false, client: null });
  const [emailStats, setEmailStats] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [queueStats, setQueueStats] = useState({ pending: 0, sent: 0, batchSize: 50, intervalMs: 60000 });
  const [sendBaseline, setSendBaseline] = useState(null);
  const [sendTotal, setSendTotal] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      try {
        const stats = getEmailQueueStats?.();
        if (stats) setQueueStats(stats);
      } catch {}
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        loadConfig(),
        loadClients(),
        loadEmailStats(),
        loadTemplates()
      ]);
    };
    init();
  }, []);

  const loadConfig = async () => {
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        setConfig(configs[0]);
        setEmailData(prev => ({
          ...prev,
          fromName: configs[0].app_name || 'Logistics App'
        }));
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setEmailData(prev => ({ ...prev, fromName: 'Logistics App' }));
    }
  };

  const loadClients = async () => {
    // Paginado: sin esto el backend devuelve solo los primeros 200 registros
    const [users, pkgs] = await Promise.all([
      fetchAllPaginated('User', { method: 'filter', query: { role: 'user' }, sort: '-created_date' }),
      fetchAllPaginated('Package', { sort: '-created_date' })
    ]);
    setClients(users);
    setPackages(pkgs);
    setLoading(false);
  };

  const loadEmailStats = async () => {
    const logs = await base44.entities.EmailLog.list('-updated_date', 200);
    const stats = {
      total: logs.length,
      delivered: logs.filter(l => ['delivered', 'opened', 'clicked'].includes(l.status)).length,
      opened: logs.filter(l => ['opened', 'clicked'].includes(l.status)).length,
      clicked: logs.filter(l => l.status === 'clicked').length,
      bounced: logs.filter(l => l.status === 'bounced').length,
      conversions: logs.filter(l => l.converted).length,
      conversionValue: logs.reduce((sum, l) => sum + (l.conversion_value || 0), 0)
    };
    setEmailStats(stats);
  };

  const loadTemplates = async () => {
    const data = await base44.entities.EmailTemplate.list('-created_date', 200);
    setTemplates(data);
  };

  const handleSelectTemplate = async (templateId) => {
    if (!templateId) {
      setSelectedTemplate(null);
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setEmailData({
        ...emailData,
        subject: template.subject,
        body: template.body,
        fromName: emailData.fromName
      });
      setAttachments(template.attachments || []);
      
      // Incrementar contador de uso
      await base44.entities.EmailTemplate.update(template.id, {
        usage_count: (template.usage_count || 0) + 1
      });
      
      toast.success('Plantilla cargada');
    }
  };

  const getTargetClients = useMemo(() => {
    const hasIncomplete = (c) => !c.first_name || !c.last_name || !c.whatsapp || !c.state || !c.city;

    if (targetType === 'all') return clients;
    if (targetType === 'with_mark') return clients.filter(c => c.shipping_mark && String(c.shipping_mark).trim().length > 0);
    if (targetType === 'without_mark') return clients.filter(c => !c.shipping_mark || String(c.shipping_mark).trim().length === 0);

    if (targetType === 'pending') {
      return clients.filter(c => (!c.shipping_mark || String(c.shipping_mark).trim().length === 0) && c.profile_completed && !hasIncomplete(c));
    }

    if (targetType === 'incomplete_data') {
      return clients.filter(c => hasIncomplete(c));
    }

    if (targetType === 'active') return clients.filter(c => c.is_active !== false);
    if (targetType === 'inactive') return clients.filter(c => c.is_active === false);

    if (targetType === 'with_packages' || targetType === 'without_packages' || targetType === 'with_active_packages') {
      const activeStatuses = ['recibido', 'consolidado', 'en_transito'];
      const clientsWithAnyPackages = new Set(packages.map(pkg => pkg.client_email));
      const clientsWithActivePackages = new Set(
        packages.filter(pkg => activeStatuses.includes(pkg.status)).map(pkg => pkg.client_email)
      );
      if (targetType === 'with_packages') return clients.filter(c => clientsWithAnyPackages.has(c.email));
      if (targetType === 'without_packages') return clients.filter(c => !clientsWithAnyPackages.has(c.email));
      return clients.filter(c => clientsWithActivePackages.has(c.email));
    }

    if (targetType === 'with_whatsapp') return clients.filter(c => !!c.whatsapp);
    if (targetType === 'without_whatsapp') return clients.filter(c => !c.whatsapp);

    if (targetType === 'custom') return clients.filter(c => selectedClients.includes(c.id));
    return [];
  }, [targetType, clients, selectedClients, packages]);

  const toggleClient = (clientId) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const getFilteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    
    const query = searchQuery.toLowerCase().trim();
    return clients.filter(client => {
      const fullName = `${client.first_name || ''} ${client.last_name || ''}`.toLowerCase();
      const email = (client.email || '').toLowerCase();
      const phone = (client.whatsapp || '').toLowerCase();
      const mark = (client.shipping_mark || '').toLowerCase();
      const cedula = (client.cedula || '').toLowerCase();
      
      return fullName.includes(query) || 
             email.includes(query) || 
             phone.includes(query) || 
             mark.includes(query) ||
             cedula.includes(query);
    });
  }, [clients, searchQuery]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingFile(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setAttachments(prev => [...prev, { name: file.name, url: file_url, size: file.size }]);
      }
      toast.success('Archivo(s) adjuntado(s)');
    } catch (error) {
      toast.error('Error al subir archivo');
    }
    setUploadingFile(false);
    e.target.value = '';
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const imageHtml = `<img src="${file_url}" alt="${file.name}" style="max-width: 100%; height: auto;" />`;
      setEmailData({ ...emailData, body: emailData.body + imageHtml });
      toast.success('Imagen insertada');
    } catch (error) {
      toast.error('Error al subir imagen');
    }
    setUploadingFile(false);
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendEmails = async () => {
    if (!emailData.subject || !emailData.body) {
      toast.error('Completa el asunto y el mensaje');
      return;
    }

    if (getTargetClients.length === 0) {
      toast.error('No hay destinatarios seleccionados');
      return;
    }

    // Inicializar contador de cola en UI
    setSendBaseline(queueStats.sent || 0);
    setSendTotal(getTargetClients.length);
    setSending(true);
    const results = { success: 0, failed: 0, errors: [] };

    try {
      let emailBody = emailData.body;
      
      if (attachments.length > 0) {
        emailBody += '\n\n--- Archivos Adjuntos ---\n';
        attachments.forEach(att => {
          emailBody += `\n${att.name}: ${att.url}`;
        });
      }

      // Preparar lote para cola backend
      const messages = getTargetClients.map((client) => {
        const personalizedSubject = replaceEmailVariables(emailData.subject, client);
        const personalizedBody = replaceEmailVariables(emailBody, client);
        return {
          to: client.email,
          subject: personalizedSubject,
          body: personalizedBody,
          from_name: emailData.fromName,
          source: 'campaign'
        };
      });

      // Enviar al backend en lotes seguros
      const chunkSize = 500;
      for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);
        const resp = await base44.functions.invoke('sendEmailQueue', { messages: chunk });
        if (resp?.status !== 200) {
          throw new Error('Fallo al encolar emails');
        }
      }

      results.success = messages.length;
      await logActionAudit(base44, user, {
        target_email: '',
        target_name: `${messages.length} destinatarios`,
        action_type: 'send_marketing_email',
        module_name: 'AdminEmailCampaigns',
        reference_id: '',
        area_name: 'Marketing',
        summary: `Envió email a ${messages.length} destinatarios`,
        details: `Asunto: ${emailData.subject} · Segmento: ${targetType}`,
        changed_fields: ['subject', 'body', 'targetType'],
      });
      
      loadEmailStats();

      setSendResult(results);
      
      if (results.failed === 0) {
        toast.success(`Emails enviados exitosamente a ${results.success} destinatarios`);
        setEmailData({ subject: '', body: '', fromName: config?.app_name || 'Logistics App' });
        setSelectedClients([]);
        setAttachments([]);
      } else {
        toast.warning(`${results.success} enviados, ${results.failed} fallidos`);
      }
      } catch (error) {
      toast.error('Error al enviar emails');
      }
      // reset baseline counters after finishing
      setSendBaseline(null);
      setSendTotal(0);
      setSending(false);
      };



  const handlePasteHtml = () => {
    if (htmlCode.trim()) {
      setEmailData({ ...emailData, body: htmlCode });
      setHtmlCode('');
      setShowHtmlInput(false);
      toast.success('HTML pegado correctamente');
    }
  };

  const quillModules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link'],
      ['clean']
    ]
  }), []);

  const quillFormats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet',
    'align',
    'link', 'image'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Envío de Emails</h1>
        <p className="text-slate-500">Envía comunicaciones manuales a tus clientes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Clientes</p>
                <p className="text-3xl font-bold text-slate-800">{clients.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Con Shipping Mark</p>
                <p className="text-3xl font-bold text-slate-800">
                  {clients.filter(c => c.shipping_mark).length}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Sin Shipping Mark</p>
                <p className="text-3xl font-bold text-slate-800">
                  {clients.filter(c => !c.shipping_mark).length}
                </p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Datos Incompletos</p>
                <p className="text-3xl font-bold text-slate-800">
                  {clients.filter(c => !c.shipping_mark && (!c.city || !c.whatsapp)).length}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Destinatarios</p>
                <p className="text-3xl font-bold text-blue-600">{getTargetClients.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Tracking Stats */}
      {emailStats && (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Estadísticas de Email Marketing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>Este módulo está en desarrollo y algunas métricas pueden no reflejar datos reales todavía.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{emailStats.total}</p>
                <p className="text-xs text-slate-600">Total Enviados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{emailStats.delivered}</p>
                <p className="text-xs text-slate-600">Entregados</p>
                <p className="text-xs text-slate-500">
                  {emailStats.total > 0 ? ((emailStats.delivered / emailStats.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{emailStats.opened}</p>
                <p className="text-xs text-slate-600">Abiertos</p>
                <p className="text-xs text-slate-500">
                  {emailStats.delivered > 0 ? ((emailStats.opened / emailStats.delivered) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">{emailStats.clicked}</p>
                <p className="text-xs text-slate-600">Clics</p>
                <p className="text-xs text-slate-500">
                  {emailStats.opened > 0 ? ((emailStats.clicked / emailStats.opened) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{emailStats.bounced}</p>
                <p className="text-xs text-slate-600">Rebotes</p>
                <p className="text-xs text-slate-500">
                  {emailStats.total > 0 ? ((emailStats.bounced / emailStats.total) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{emailStats.conversions}</p>
                <p className="text-xs text-slate-600">Conversiones</p>
                <p className="text-xs text-slate-500">
                  {emailStats.clicked > 0 ? ((emailStats.conversions / emailStats.clicked) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">${emailStats.conversionValue.toFixed(0)}</p>
                <p className="text-xs text-slate-600">Ingresos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Composer */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Redactar Email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Usar Plantilla (Opcional)</Label>
                <Select value={selectedTemplate?.id || ''} onValueChange={handleSelectTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una plantilla" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Sin plantilla</SelectItem>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} ({template.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <p className="text-xs text-blue-600">
                    Plantilla cargada. Puedes modificar el contenido si lo necesitas.
                  </p>
                )}
              </div>

              <EmailAIAssistant
                appName={config?.app_name || 'Logistics App'}
                onApply={({ subject, body }) => setEmailData(prev => ({ ...prev, subject, body }))}
              />

              <div className="space-y-2">
                <Label>Nombre del Remitente</Label>
                <Input
                  value={emailData.fromName}
                  onChange={(e) => setEmailData({ ...emailData, fromName: e.target.value })}
                  placeholder={config?.app_name || 'Logistics App'}
                />
              </div>

              <div className="space-y-2">
                <Label>Asunto *</Label>
                <Input
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  placeholder="Ej: Nuevas tarifas de envío"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Mensaje *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHtmlInput(!showHtmlInput)}
                  >
                    {showHtmlInput ? 'Cerrar HTML' : '< > Pegar HTML'}
                  </Button>
                </div>

                {showHtmlInput ? (
                  <div className="space-y-2">
                    <Textarea
                      value={htmlCode}
                      onChange={(e) => setHtmlCode(e.target.value)}
                      placeholder="Pega tu código HTML aquí..."
                      rows={12}
                      className="font-mono text-sm"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        type="button"
                        onClick={handlePasteHtml}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Aplicar HTML
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setHtmlCode('');
                          setShowHtmlInput(false);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Suspense fallback={<div className="border rounded-lg p-4 bg-slate-50 h-80 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>}>
                    <div className="border rounded-lg overflow-hidden">
                      <ReactQuill
                        theme="snow"
                        value={emailData.body}
                        onChange={(content) => setEmailData({ ...emailData, body: content })}
                        modules={quillModules}
                        formats={quillFormats}
                        placeholder="Escribe tu mensaje aquí..."
                        className="bg-white"
                        style={{ minHeight: '300px' }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Usa la barra de herramientas para dar formato o el botón "Pegar HTML" para código personalizado
                    </p>
                  </Suspense>
                )}
              </div>

              <div className="space-y-3">
                <Label>Adjuntos e Imágenes</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex-1">
                    <Button 
                      type="button"
                      variant="outline" 
                      className="w-full"
                      disabled={uploadingFile}
                      asChild
                    >
                      <span>
                        {uploadingFile ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Subiendo...</>
                        ) : (
                          <><Paperclip className="h-4 w-4 mr-2" /> Adjuntar Archivo</>
                        )}
                      </span>
                    </Button>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      multiple
                      disabled={uploadingFile}
                    />
                  </label>

                  <label className="flex-1">
                    <Button 
                      type="button"
                      variant="outline" 
                      className="w-full"
                      disabled={uploadingFile}
                      asChild
                    >
                      <span>
                        {uploadingFile ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Subiendo...</>
                        ) : (
                          <><ImageIcon className="h-4 w-4 mr-2" /> Insertar Imagen</>
                        )}
                      </span>
                    </Button>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingFile}
                    />
                  </label>
                </div>

                {attachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Archivos adjuntos:</p>
                    {attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border">
                        <Paperclip className="h-4 w-4 text-slate-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{att.name}</p>
                          <p className="text-xs text-slate-500">{(att.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="header-actions flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => setPreviewOpen(true)}
                  variant="outline"
                  className="flex-1"
                  disabled={!emailData.subject || !emailData.body}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Vista Previa
                </Button>
                <Button
                  onClick={handleSendEmails}
                  disabled={sending || !emailData.subject || !emailData.body || getTargetClients.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {sending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Enviar a {getTargetClients.length} destinatarios</>
                  )}
                </Button>
              </div>

              {/* Estado de la cola de envíos */}
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span>
                    En cola: <span className="font-semibold text-slate-800">{sendBaseline !== null ? Math.max(sendTotal - Math.max(0, queueStats.sent - sendBaseline), 0) : queueStats.pending}</span>
                    <span className="text-slate-500"> • lote {queueStats.batchSize} / {Math.round(queueStats.intervalMs/1000)}s</span>
                  </span>
                  <span>
                    Enviados por cola: <span className="font-semibold text-slate-800">{queueStats.sent}</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Send Results */}
          {sendResult && (
            <Card className={`border-0 shadow-lg ${sendResult.failed === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${sendResult.failed === 0 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    {sendResult.failed === 0 ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800 mb-2">Resultado del Envío</h3>
                    <div className="space-y-1 text-sm">
                      <p className="text-emerald-700">✓ {sendResult.success} emails enviados exitosamente</p>
                      {sendResult.failed > 0 && (
                        <>
                          <p className="text-red-700">✗ {sendResult.failed} emails fallidos</p>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-slate-600 hover:text-slate-800">Ver errores</summary>
                            <div className="mt-2 space-y-1 text-xs">
                              {sendResult.errors.map((err, idx) => (
                                <p key={idx} className="text-red-600">• {err.email}: {err.error}</p>
                              ))}
                            </div>
                          </details>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Target Selection */}
        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Destinatarios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Seleccionar Grupo</Label>
                <Select value={targetType} onValueChange={setTargetType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      Todos los clientes ({clients.length})
                    </SelectItem>
                    <SelectItem value="with_mark">
                      Con Shipping Mark ({clients.filter(c => c.shipping_mark && String(c.shipping_mark).trim().length > 0).length})
                    </SelectItem>
                    <SelectItem value="without_mark">
                      Sin Shipping Mark ({clients.filter(c => !c.shipping_mark || String(c.shipping_mark).trim().length === 0).length})
                    </SelectItem>
                    <SelectItem value="pending">
                      Pendientes ({clients.filter(c => (!c.shipping_mark || String(c.shipping_mark).trim().length === 0) && c.profile_completed && !(!c.first_name || !c.last_name || !c.whatsapp || !c.state || !c.city)).length})
                    </SelectItem>
                    <SelectItem value="incomplete_data">
                      Con Datos Incompletos ({clients.filter(c => !c.first_name || !c.last_name || !c.whatsapp || !c.state || !c.city).length})
                    </SelectItem>
                    <SelectItem value="active">
                      Activos ({clients.filter(c => c.is_active !== false).length})
                    </SelectItem>
                    <SelectItem value="inactive">
                      Inactivos ({clients.filter(c => c.is_active === false).length})
                    </SelectItem>
                    <SelectItem value="with_packages">
                      Con Paquetes ({(() => {
                        const clientsWithAnyPackages = new Set(packages.map(pkg => pkg.client_email));
                        return clients.filter(c => clientsWithAnyPackages.has(c.email)).length;
                      })()})
                    </SelectItem>
                    <SelectItem value="without_packages">
                      Sin Paquetes ({(() => {
                        const clientsWithAnyPackages = new Set(packages.map(pkg => pkg.client_email));
                        return clients.filter(c => !clientsWithAnyPackages.has(c.email)).length;
                      })()})
                    </SelectItem>
                    <SelectItem value="with_active_packages">
                      Con Paquetes Activos ({(() => {
                        const activeStatuses = ['recibido', 'consolidado', 'en_transito'];
                        const clientsWithActivePackages = new Set(
                          packages.filter(pkg => activeStatuses.includes(pkg.status)).map(pkg => pkg.client_email)
                        );
                        return clients.filter(c => clientsWithActivePackages.has(c.email)).length;
                      })()})
                    </SelectItem>
                    <SelectItem value="with_whatsapp">
                      Con WhatsApp ({clients.filter(c => !!c.whatsapp).length})
                    </SelectItem>
                    <SelectItem value="without_whatsapp">
                      Sin WhatsApp ({clients.filter(c => !c.whatsapp).length})
                    </SelectItem>
                    <SelectItem value="custom">
                      Selección personalizada
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetType === 'custom' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Seleccionar clientes</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedClients(selectedClients.length === clients.length ? [] : clients.map(c => c.id))}
                    >
                      {selectedClients.length === clients.length ? 'Deseleccionar' : 'Seleccionar'} todos
                    </Button>
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Buscar por nombre, email, teléfono o shipping mark..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto">
                   {getFilteredClients.length === 0 ? (
                     <p className="text-sm text-slate-500 text-center py-8">No se encontraron clientes</p>
                   ) : (
                     getFilteredClients.map((client) => (
                      <div
                        key={client.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedClients.includes(client.id)
                            ? 'bg-blue-50 border-blue-200'
                            : 'hover:bg-slate-50 border-slate-200'
                        }`}
                        onClick={() => toggleClient(client.id)}
                      >
                        <Checkbox
                          checked={selectedClients.includes(client.id)}
                          onCheckedChange={() => toggleClient(client.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-800 truncate">
                            {client.first_name && client.last_name
                              ? `${client.first_name} ${client.last_name}`
                              : client.email}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{client.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {client.shipping_mark && (
                              <Badge variant="outline" className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {client.shipping_mark}
                              </Badge>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setHistoryModal({ 
                                  open: true, 
                                  client: { 
                                    email: client.email, 
                                    name: `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.email 
                                  } 
                                });
                              }}
                              className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1"
                            >
                              <History className="h-3 w-3" />
                              Ver historial
                            </button>
                          </div>
                        </div>
                      </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total destinatarios:</span>
                  <span className="font-bold text-blue-600">{getTargetClients.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vista Previa del Email</DialogTitle>
            <DialogDescription>
              Así se verá el email que recibirán los destinatarios
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500">De:</p>
                  <p className="font-medium">{emailData.fromName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Asunto:</p>
                  <p className="font-medium">{emailData.subject}</p>
                </div>
                <div className="pt-3 border-t">
                  <p className="text-xs text-slate-500 mb-2">Mensaje:</p>
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: emailData.body }}
                  />
                </div>
                {attachments.length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-slate-500 mb-2">Archivos adjuntos:</p>
                    <div className="space-y-1">
                      {attachments.map((att, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Paperclip className="h-3 w-3 text-slate-400" />
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {att.name}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email History Modal */}
      <EmailHistoryModal
        open={historyModal.open}
        onClose={() => setHistoryModal({ open: false, client: null })}
        clientEmail={historyModal.client?.email}
        clientName={historyModal.client?.name}
      />
    </div>
  );
}