import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Plus, Loader2, Mail, Bell, Users, TrendingUp, Calendar, Send, Eye, MousePointer, DollarSign, Edit, Trash2, Paperclip, X, Image as ImageIcon, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import EmailHistoryModal from '@/components/admin/EmailHistoryModal';
import { replaceEmailVariables } from '@/components/EmailVariableReplacer';

export default function AdminMarketing({ user }) {
  const [campaigns, setCampaigns] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [saving, setSaving] = useState(false);
  const [segmentPreview, setSegmentPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showHtmlInput, setShowHtmlInput] = useState(false);
  const [htmlCode, setHtmlCode] = useState('');
  const [historyModal, setHistoryModal] = useState({ open: false, client: null });
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    campaign_type: 'email',
    target_segment: 'all',
    email_subject: '',
    email_body: '',
    notification_title: '',
    notification_message: '',
    promotion_id: '',
    scheduled_date: ''
  });

  useEffect(() => {
    loadConfig();
    loadData();
    loadTemplates();
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

  const loadData = async () => {
    const [campaignsData, promosData] = await Promise.all([
      base44.entities.MarketingCampaign.list('-created_date'),
      base44.entities.Promotion.list('-created_date')
    ]);
    setCampaigns(campaignsData);
    setPromotions(promosData);
    setLoading(false);
  };

  const loadTemplates = async () => {
    const data = await base44.entities.EmailTemplate.list('-created_date');
    setEmailTemplates(data);
  };

  const handleSelectTemplate = async (templateId) => {
    if (!templateId) {
      setSelectedTemplate(null);
      return;
    }
    
    const template = emailTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setFormData({
        ...formData,
        email_subject: template.subject,
        email_body: template.body
      });
      setAttachments(template.attachments || []);
      
      // Incrementar contador de uso
      await base44.entities.EmailTemplate.update(template.id, {
        usage_count: (template.usage_count || 0) + 1
      });
      
      toast.success('Plantilla cargada');
    }
  };

  const getSegmentClients = async (segment) => {
    const allUsers = await base44.entities.User.filter({ role: 'user' });
    
    if (segment === 'all') return allUsers;
    
    const consolidations = await base44.entities.Consolidation.list();
    
    if (segment === 'new_customers') {
      const clientsWithConsolidations = new Set(consolidations.map(c => c.client_email));
      return allUsers.filter(u => !clientsWithConsolidations.has(u.email));
    }
    
    if (segment === 'returning_customers') {
      const clientCounts = {};
      consolidations.forEach(c => {
        clientCounts[c.client_email] = (clientCounts[c.client_email] || 0) + 1;
      });
      return allUsers.filter(u => clientCounts[u.email] >= 2);
    }
    
    if (segment === 'high_value') {
      const clientTotals = {};
      consolidations.forEach(c => {
        clientTotals[c.client_email] = (clientTotals[c.client_email] || 0) + (c.total_cost || 0);
      });
      return allUsers.filter(u => clientTotals[u.email] >= 500);
    }
    
    if (segment === 'inactive') {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const recentClients = new Set(
        consolidations
          .filter(c => new Date(c.created_date) > threeMonthsAgo)
          .map(c => c.client_email)
      );
      
      return allUsers.filter(u => !recentClients.has(u.email));
    }
    
    return allUsers;
  };

  const handlePreviewSegment = async (segment) => {
    setLoadingPreview(true);
    const clients = await getSegmentClients(segment);
    setSegmentPreview({ segment, count: clients.length, clients });
    setLoadingPreview(false);
  };

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
      setFormData({ ...formData, email_body: formData.email_body + imageHtml });
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

  const handleOpenModal = (campaign = null) => {
    if (campaign) {
      setEditingCampaign(campaign);
      setFormData(campaign);
    } else {
      setEditingCampaign(null);
      setFormData({
        name: '',
        description: '',
        campaign_type: 'email',
        target_segment: 'all',
        email_subject: '',
        email_body: '',
        notification_title: '',
        notification_message: '',
        promotion_id: '',
        scheduled_date: ''
      });
    }
    setSegmentPreview(null);
    setAttachments([]);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.target_segment) {
      toast.error('Completa los campos requeridos');
      return;
    }

    if (formData.campaign_type === 'email' && (!formData.email_subject || !formData.email_body)) {
      toast.error('Completa el asunto y cuerpo del email');
      return;
    }

    if ((formData.campaign_type === 'notification' || formData.campaign_type === 'both') && 
        (!formData.notification_title || !formData.notification_message)) {
      toast.error('Completa el título y mensaje de la notificación');
      return;
    }

    setSaving(true);
    try {
      const clients = await getSegmentClients(formData.target_segment);
      const campaignData = {
        ...formData,
        recipients_count: clients.length,
        status: formData.scheduled_date ? 'scheduled' : 'draft'
      };

      if (editingCampaign) {
        await base44.entities.MarketingCampaign.update(editingCampaign.id, campaignData);
        toast.success('Campaña actualizada');
      } else {
        await base44.entities.MarketingCampaign.create(campaignData);
        toast.success('Campaña creada');
      }
      
      setShowModal(false);
      loadData();
    } catch (error) {
      toast.error('Error al guardar');
    }
    setSaving(false);
  };

  const handleSendNow = async (campaign) => {
    if (!confirm('¿Enviar esta campaña ahora?')) return;
    
    try {
      const clients = await getSegmentClients(campaign.target_segment);
      
      // Send emails
      if (campaign.campaign_type === 'email' || campaign.campaign_type === 'both') {
        let emailBody = campaign.email_body;
        
        if (attachments.length > 0) {
          emailBody += '\n\n--- Archivos Adjuntos ---\n';
          attachments.forEach(att => {
            emailBody += `\n${att.name}: ${att.url}`;
          });
        }

        for (const client of clients) {
          // Reemplazar variables en el asunto y cuerpo
          const personalizedSubject = replaceEmailVariables(campaign.email_subject, client);
          const personalizedBody = replaceEmailVariables(emailBody, client);
          
          await base44.integrations.Core.SendEmail({
            to: client.email,
            subject: personalizedSubject,
            body: personalizedBody
          });
          
          // Log the email
              await base44.entities.EmailLog.create({
                recipient_email: client.email,
                recipient_name: `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.email,
                sender_email: user.email,
                from_name: config?.app_name || 'Logistics App',
                subject: personalizedSubject,
                body_preview: personalizedBody.replace(/<[^>]*>/g, '').substring(0, 200),
                campaign_id: campaign.id,
                campaign_name: campaign.name,
                source: 'campaign',
                status: 'delivered',
                sent_date: new Date().toISOString(),
                delivered_date: new Date().toISOString(),
                open_count: 0,
                click_count: 0,
                converted: false,
                conversion_value: 0
              });
        }
      }
      
      // Send notifications
      if (campaign.campaign_type === 'notification' || campaign.campaign_type === 'both') {
        for (const client of clients) {
          await base44.entities.Notification.create({
            user_email: client.email,
            title: campaign.notification_title,
            message: campaign.notification_message,
            type: 'general',
            icon: 'package'
          });
        }
      }
      
      await base44.entities.MarketingCampaign.update(campaign.id, {
        status: 'sent',
        sent_date: new Date().toISOString()
      });
      
      toast.success(`Campaña enviada a ${clients.length} clientes`);
      loadData();
    } catch (error) {
      toast.error('Error al enviar campaña');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta campaña?')) return;
    
    try {
      await base44.entities.MarketingCampaign.delete(id);
      toast.success('Campaña eliminada');
      loadData();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handlePasteHtml = () => {
    if (htmlCode.trim()) {
      setFormData({ ...formData, email_body: htmlCode });
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

  const [emailStats, setEmailStats] = useState({
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    conversions: 0,
    revenue: 0
  });

  useEffect(() => {
    calculateEmailStats();
  }, []);

  const calculateEmailStats = async () => {
    try {
      const emailLogs = await base44.entities.EmailLog.list();
      const stats = {
        delivered: emailLogs.filter(e => e.status === 'delivered').length,
        opened: emailLogs.filter(e => e.status === 'opened').length,
        clicked: emailLogs.filter(e => e.status === 'clicked').length,
        bounced: emailLogs.filter(e => e.status === 'bounced').length,
        conversions: emailLogs.filter(e => e.converted).length,
        revenue: emailLogs.reduce((sum, e) => sum + (e.conversion_value || 0), 0)
      };
      setEmailStats(stats);
    } catch (error) {
      console.error('Error calculating email stats:', error);
    }
  };

  const stats = {
    total: campaigns.length,
    sent: campaigns.filter(c => c.status === 'sent').length,
    scheduled: campaigns.filter(c => c.status === 'scheduled').length,
    avgOpenRate: emailStats.opened > 0 && emailStats.delivered > 0
      ? ((emailStats.opened / emailStats.delivered) * 100).toFixed(1)
      : 0,
    totalRevenue: emailStats.revenue
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Campañas de Marketing</h1>
          <p className="text-slate-500">Gestiona campañas de email y notificaciones</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Campaña
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              </div>
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Enviadas</p>
                <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
              </div>
              <Send className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Programadas</p>
                <p className="text-2xl font-bold text-orange-600">{stats.scheduled}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Apertura</p>
                <p className="text-2xl font-bold text-purple-600">{stats.avgOpenRate}%</p>
              </div>
              <Eye className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
           <CardContent className="p-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-slate-500">Entregados</p>
                 <p className="text-2xl font-bold text-green-600">{emailStats.delivered}</p>
                 <p className="text-xs text-slate-500 mt-1">0.0%</p>
               </div>
               <Send className="h-8 w-8 text-green-600" />
             </div>
           </CardContent>
         </Card>

         <Card className="border-0 shadow-lg">
           <CardContent className="p-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-slate-500">Abiertos</p>
                 <p className="text-2xl font-bold text-purple-600">{emailStats.opened}</p>
                 <p className="text-xs text-slate-500 mt-1">0.0%</p>
               </div>
               <Eye className="h-8 w-8 text-purple-600" />
             </div>
           </CardContent>
         </Card>

         <Card className="border-0 shadow-lg">
           <CardContent className="p-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-slate-500">Clics</p>
                 <p className="text-2xl font-bold text-indigo-600">
                   {emailStats.clicked}
                 </p>
                 <p className="text-xs text-slate-500 mt-1">0.0%</p>
               </div>
               <MousePointer className="h-8 w-8 text-indigo-600" />
             </div>
           </CardContent>
         </Card>

         <Card className="border-0 shadow-lg">
           <CardContent className="p-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-slate-500">Rebotes</p>
                 <p className="text-2xl font-bold text-red-600">
                   {emailStats.bounced}
                 </p>
                 <p className="text-xs text-slate-500 mt-1">0.0%</p>
               </div>
               <XCircle className="h-8 w-8 text-red-600" />
             </div>
           </CardContent>
         </Card>

         <Card className="border-0 shadow-lg">
           <CardContent className="p-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-slate-500">Conversiones</p>
                 <p className="text-2xl font-bold text-teal-600">
                   {emailStats.conversions}
                 </p>
                 <p className="text-xs text-slate-500 mt-1">0.0%</p>
               </div>
               <TrendingUp className="h-8 w-8 text-teal-600" />
             </div>
           </CardContent>
         </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ingresos</p>
                <p className="text-2xl font-bold text-emerald-600">${stats.totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <div className="grid gap-4">
        {campaigns.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Mail className="h-16 w-16 text-slate-300 mb-4" />
              <p className="text-slate-500">No hay campañas creadas</p>
            </CardContent>
          </Card>
        ) : (
          campaigns.map(campaign => (
            <Card key={campaign.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">{campaign.name}</h3>
                      {campaign.status === 'sent' && (
                        <Badge className="bg-green-100 text-green-800">Enviada</Badge>
                      )}
                      {campaign.status === 'scheduled' && (
                        <Badge className="bg-orange-100 text-orange-800">Programada</Badge>
                      )}
                      {campaign.status === 'draft' && (
                        <Badge className="bg-slate-100 text-slate-800">Borrador</Badge>
                      )}
                      {campaign.campaign_type === 'email' && <Mail className="h-4 w-4 text-blue-600" />}
                      {campaign.campaign_type === 'notification' && <Bell className="h-4 w-4 text-purple-600" />}
                      {campaign.campaign_type === 'both' && (
                        <>
                          <Mail className="h-4 w-4 text-blue-600" />
                          <Bell className="h-4 w-4 text-purple-600" />
                        </>
                      )}
                    </div>
                    
                    <p className="text-slate-600 mb-3">{campaign.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-500" />
                        {campaign.recipients_count} destinatarios
                      </div>
                      {campaign.status === 'sent' && (
                        <>
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-purple-600" />
                            {campaign.opened_count} aperturas ({campaign.recipients_count > 0 ? ((campaign.opened_count / campaign.recipients_count) * 100).toFixed(1) : 0}%)
                          </div>
                          <div className="flex items-center gap-2">
                            <MousePointer className="h-4 w-4 text-blue-600" />
                            {campaign.clicked_count} clics ({campaign.opened_count > 0 ? ((campaign.clicked_count / campaign.opened_count) * 100).toFixed(1) : 0}% CTR)
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-teal-600" />
                            {campaign.converted_count || 0} conversiones
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            ${(campaign.revenue_generated || 0).toFixed(2)}
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="flex gap-4 mt-3 text-sm text-slate-500">
                      <span>Segmento: {campaign.target_segment}</span>
                      {campaign.scheduled_date && (
                        <span>Programada: {new Date(campaign.scheduled_date).toLocaleString()}</span>
                      )}
                      {campaign.sent_date && (
                        <span>Enviada: {new Date(campaign.sent_date).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {campaign.status === 'draft' && (
                      <Button
                        onClick={() => handleSendNow(campaign)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Enviar Ahora
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleOpenModal(campaign)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(campaign.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Editar Campaña' : 'Nueva Campaña'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nombre de la Campaña *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ej: Promoción Verano"
                />
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Descripción de la campaña..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Campaña *</Label>
                <Select value={formData.campaign_type} onValueChange={(val) => setFormData({...formData, campaign_type: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Solo Email</SelectItem>
                    <SelectItem value="notification">Solo Notificación</SelectItem>
                    <SelectItem value="both">Email + Notificación</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Segmento Objetivo *</Label>
                <div className="flex gap-2">
                  <Select value={formData.target_segment} onValueChange={(val) => {
                    setFormData({...formData, target_segment: val});
                    handlePreviewSegment(val);
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="new_customers">Clientes Nuevos</SelectItem>
                      <SelectItem value="returning_customers">Recurrentes</SelectItem>
                      <SelectItem value="high_value">Alto Valor</SelectItem>
                      <SelectItem value="inactive">Inactivos (3+ meses)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {segmentPreview && (
                  <p className="text-sm text-slate-600">
                    {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin inline" /> : `${segmentPreview.count} clientes`}
                  </p>
                )}
              </div>

              {(formData.campaign_type === 'email' || formData.campaign_type === 'both') && (
                <>
                  <div className="col-span-2 space-y-2">
                    <Label>Usar Plantilla (Opcional)</Label>
                    <Select value={selectedTemplate?.id || ''} onValueChange={handleSelectTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una plantilla" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>Sin plantilla</SelectItem>
                        {emailTemplates.map(template => (
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

                  <div className="col-span-2 space-y-2">
                    <Label>Asunto del Email *</Label>
                    <Input
                      value={formData.email_subject}
                      onChange={(e) => setFormData({...formData, email_subject: e.target.value})}
                      placeholder="¡Oferta especial para ti!"
                    />
                  </div>
                  
                  <div className="col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Cuerpo del Email *</Label>
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
                          rows={10}
                          className="font-mono text-sm"
                        />
                        <div className="flex gap-2">
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
                      <>
                        <div className="border rounded-lg overflow-hidden">
                          <ReactQuill
                            theme="snow"
                            value={formData.email_body}
                            onChange={(content) => setFormData({ ...formData, email_body: content })}
                            modules={quillModules}
                            formats={quillFormats}
                            placeholder="Escribe tu mensaje aquí..."
                            className="bg-white"
                            style={{ minHeight: '250px' }}
                          />
                        </div>
                        <p className="text-xs text-slate-500">
                          Usa la barra de herramientas para dar formato o el botón "Pegar HTML" para código personalizado
                        </p>
                      </>
                    )}
                  </div>

                  <div className="col-span-2 space-y-3">
                    <Label>Adjuntos e Imágenes</Label>
                    <div className="flex gap-2">
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
                </>
              )}

              {(formData.campaign_type === 'notification' || formData.campaign_type === 'both') && (
                <>
                  <div className="col-span-2 space-y-2">
                    <Label>Título de la Notificación *</Label>
                    <Input
                      value={formData.notification_title}
                      onChange={(e) => setFormData({...formData, notification_title: e.target.value})}
                      placeholder="¡Nueva oferta disponible!"
                    />
                  </div>
                  
                  <div className="col-span-2 space-y-2">
                    <Label>Mensaje de la Notificación *</Label>
                    <Textarea
                      value={formData.notification_message}
                      onChange={(e) => setFormData({...formData, notification_message: e.target.value})}
                      placeholder="Mensaje de la notificación..."
                      rows={3}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Promoción Asociada (opcional)</Label>
                <Select value={formData.promotion_id} onValueChange={(val) => setFormData({...formData, promotion_id: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ninguna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Ninguna</SelectItem>
                    {promotions.filter(p => p.is_active).map(promo => (
                      <SelectItem key={promo.id} value={promo.id}>
                        {promo.name} ({promo.discount_value}{promo.discount_type === 'percentage' ? '%' : '$'} OFF)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Programar Envío (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
                />
                <p className="text-xs text-slate-500">Dejar vacío para guardar como borrador</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingCampaign ? 'Actualizar' : 'Crear'} Campaña
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