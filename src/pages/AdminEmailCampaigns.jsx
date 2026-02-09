import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
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
  Upload
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from 'sonner';

export default function AdminEmailCampaigns({ user }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [targetType, setTargetType] = useState('all');
  const [selectedClients, setSelectedClients] = useState([]);
  const [emailData, setEmailData] = useState({
    subject: '',
    body: '',
    fromName: 'TLEC Logistics'
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const users = await base44.entities.User.filter({ role: 'user' });
    setClients(users);
    setLoading(false);
  };

  const getTargetClients = () => {
    if (targetType === 'all') return clients;
    if (targetType === 'with_mark') return clients.filter(c => c.shipping_mark);
    if (targetType === 'without_mark') return clients.filter(c => !c.shipping_mark);
    if (targetType === 'custom') return clients.filter(c => selectedClients.includes(c.id));
    return [];
  };

  const toggleClient = (clientId) => {
    setSelectedClients(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const getFilteredClients = () => {
    if (!searchQuery.trim()) return clients;
    
    const query = searchQuery.toLowerCase().trim();
    return clients.filter(client => {
      const fullName = `${client.first_name || ''} ${client.last_name || ''}`.toLowerCase();
      const email = (client.email || '').toLowerCase();
      const phone = (client.whatsapp || '').toLowerCase();
      const mark = (client.shipping_mark || '').toLowerCase();
      
      return fullName.includes(query) || 
             email.includes(query) || 
             phone.includes(query) || 
             mark.includes(query);
    });
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

    const targets = getTargetClients();
    if (targets.length === 0) {
      toast.error('No hay destinatarios seleccionados');
      return;
    }

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

      for (const client of targets) {
        try {
          await base44.integrations.Core.SendEmail({
            from_name: emailData.fromName,
            to: client.email,
            subject: emailData.subject,
            body: emailBody
          });
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push({ email: client.email, error: error.message });
        }
      }

      setSendResult(results);
      
      if (results.failed === 0) {
        toast.success(`Emails enviados exitosamente a ${results.success} destinatarios`);
        setEmailData({ subject: '', body: '', fromName: 'TLEC Logistics' });
        setSelectedClients([]);
        setAttachments([]);
      } else {
        toast.warning(`${results.success} enviados, ${results.failed} fallidos`);
      }
    } catch (error) {
      toast.error('Error al enviar emails');
    }
    setSending(false);
  };

  const targetClients = getTargetClients();

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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
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

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Destinatarios</p>
                <p className="text-3xl font-bold text-blue-600">{targetClients.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Mail className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                <Label>Nombre del Remitente</Label>
                <Input
                  value={emailData.fromName}
                  onChange={(e) => setEmailData({ ...emailData, fromName: e.target.value })}
                  placeholder="TLEC Logistics"
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
                <Label>Mensaje *</Label>
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
                  Usa la barra de herramientas para dar formato a tu mensaje
                </p>
              </div>

              <div className="space-y-3">
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

              <div className="flex gap-3">
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
                  disabled={sending || !emailData.subject || !emailData.body || targetClients.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {sending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Enviar a {targetClients.length} destinatarios</>
                  )}
                </Button>
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
                      Con Shipping Mark ({clients.filter(c => c.shipping_mark).length})
                    </SelectItem>
                    <SelectItem value="without_mark">
                      Sin Shipping Mark ({clients.filter(c => !c.shipping_mark).length})
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
                    {getFilteredClients().length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-8">No se encontraron clientes</p>
                    ) : (
                      getFilteredClients().map((client) => (
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
                          {client.shipping_mark && (
                            <Badge variant="outline" className="text-xs mt-1">
                              <Tag className="h-3 w-3 mr-1" />
                              {client.shipping_mark}
                            </Badge>
                          )}
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
                  <span className="font-bold text-blue-600">{targetClients.length}</span>
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
    </div>
  );
}