import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Plus, Loader2, Mail, Edit, Trash2, Eye, Copy, Paperclip, X, Image as ImageIcon, Star } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminEmailTemplates({ user }) {
  const [templates, setTemplates] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewModal, setPreviewModal] = useState({ open: false, template: null });
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showHtmlInput, setShowHtmlInput] = useState(false);
  const [htmlCode, setHtmlCode] = useState('');
  const [updatingTemplates, setUpdatingTemplates] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    subject: '',
    body: '',
    variables: []
  });

  useEffect(() => {
    loadConfig();
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

  const loadTemplates = async () => {
    const data = await base44.entities.EmailTemplate.list('-created_date');
    setTemplates(data);
    setLoading(false);
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
      setFormData({ ...formData, body: formData.body + imageHtml });
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

  const handleOpenModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        category: template.category,
        subject: template.subject,
        body: template.body,
        variables: template.variables || []
      });
      setAttachments(template.attachments || []);
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        category: 'general',
        subject: '',
        body: '',
        variables: []
      });
      setAttachments([]);
    }
    setShowHtmlInput(false);
    setHtmlCode('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.subject || !formData.body) {
      toast.error('Completa los campos requeridos');
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        ...formData,
        attachments,
        is_default: editingTemplate?.is_default || false
      };

      if (editingTemplate) {
        await base44.entities.EmailTemplate.update(editingTemplate.id, templateData);
        toast.success('Plantilla actualizada');
      } else {
        await base44.entities.EmailTemplate.create(templateData);
        toast.success('Plantilla creada');
      }
      
      setShowModal(false);
      loadTemplates();
    } catch (error) {
      toast.error('Error al guardar');
    }
    setSaving(false);
  };

  const handleDelete = async (id, isDefault) => {
    if (isDefault) {
      toast.error('No se pueden eliminar plantillas predeterminadas');
      return;
    }
    
    if (!confirm('¿Eliminar esta plantilla?')) return;
    
    try {
      await base44.entities.EmailTemplate.delete(id);
      toast.success('Plantilla eliminada');
      loadTemplates();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleDuplicate = async (template) => {
    try {
      await base44.entities.EmailTemplate.create({
        name: `${template.name} (Copia)`,
        description: template.description,
        category: template.category,
        subject: template.subject,
        body: template.body,
        attachments: template.attachments || [],
        variables: template.variables || [],
        is_default: false
      });
      toast.success('Plantilla duplicada');
      loadTemplates();
    } catch (error) {
      toast.error('Error al duplicar');
    }
  };

  const handlePasteHtml = () => {
    if (htmlCode.trim()) {
      setFormData({ ...formData, body: htmlCode });
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

  const categoryColors = {
    general: 'bg-slate-100 text-slate-800',
    bienvenida: 'bg-blue-100 text-blue-800',
    paquetes: 'bg-purple-100 text-purple-800',
    consolidacion: 'bg-indigo-100 text-indigo-800',
    pagos: 'bg-green-100 text-green-800',
    marketing: 'bg-orange-100 text-orange-800'
  };

  const stats = {
    total: templates.length,
    byCategory: templates.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {}),
    defaults: templates.filter(t => t.is_default).length,
    custom: templates.filter(t => !t.is_default).length
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
          <h1 className="text-2xl font-bold text-slate-800">Plantillas de Email</h1>
          <p className="text-slate-500">Gestiona plantillas reutilizables para tus emails</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
              </div>
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Predeterminadas</p>
                <p className="text-3xl font-bold text-amber-600">{stats.defaults}</p>
              </div>
              <Star className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Personalizadas</p>
                <p className="text-3xl font-bold text-green-600">{stats.custom}</p>
              </div>
              <Edit className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Más Usadas</p>
                <p className="text-3xl font-bold text-purple-600">
                  {templates.filter(t => t.usage_count > 0).length}
                </p>
              </div>
              <Copy className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.length === 0 ? (
          <Card className="col-span-full border-0 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Mail className="h-16 w-16 text-slate-300 mb-4" />
              <p className="text-slate-500">No hay plantillas creadas</p>
            </CardContent>
          </Card>
        ) : (
          templates.map(template => (
            <Card key={template.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.is_default && (
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={categoryColors[template.category]}>
                        {template.category}
                      </Badge>
                      {template.usage_count > 0 && (
                        <span className="text-xs text-slate-500">
                          Usado {template.usage_count} {template.usage_count === 1 ? 'vez' : 'veces'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {template.description && (
                  <p className="text-sm text-slate-600 mb-3">{template.description}</p>
                )}
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Asunto: <span className="font-normal">{template.subject}</span>
                </p>
                {template.attachments?.length > 0 && (
                  <p className="text-xs text-slate-500 mb-3">
                    {template.attachments.length} {template.attachments.length === 1 ? 'adjunto' : 'adjuntos'}
                  </p>
                )}
                {template.variables?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-600 mb-1">Variables:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map((v, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewModal({ open: true, template })}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Vista Previa
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDuplicate(template)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleOpenModal(template)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {!template.is_default && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(template.id, template.is_default)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
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
            <DialogTitle>{editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nombre de la Plantilla *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ej: Bienvenida Nuevo Cliente"
                />
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe cuándo usar esta plantilla..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Categoría *</Label>
                <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="bienvenida">Bienvenida</SelectItem>
                    <SelectItem value="paquetes">Paquetes</SelectItem>
                    <SelectItem value="consolidacion">Consolidación</SelectItem>
                    <SelectItem value="pagos">Pagos</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Glosario de Variables Disponibles</Label>
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-700 mb-2">Cliente</p>
                      <div className="space-y-1 text-slate-600">
                        <p><code className="bg-slate-200 px-1 rounded">{'{cliente_nombre}'}</code> - Nombre completo</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{email}'}</code> - Email del cliente</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{whatsapp}'}</code> - Teléfono</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{ciudad}'}</code> - Ciudad</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{shipping_mark}'}</code> - Shipping Mark</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 mb-2">Paquetes</p>
                      <div className="space-y-1 text-slate-600">
                        <p><code className="bg-slate-200 px-1 rounded">{'{tracking}'}</code> - Número de tracking</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{tipo_envio}'}</code> - Aéreo/Marítimo</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{descripcion}'}</code> - Descripción</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 mb-2">Consolidación</p>
                      <div className="space-y-1 text-slate-600">
                        <p><code className="bg-slate-200 px-1 rounded">{'{consolidation_tracking}'}</code> - Tracking</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{peso}'}</code> - Peso facturable</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{costo_envio}'}</code> - Costo</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{seguro}'}</code> - Seguro</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{total}'}</code> - Total</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{fecha_estimada}'}</code> - Fecha llegada</p>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 mb-2">Marketing</p>
                      <div className="space-y-1 text-slate-600">
                        <p><code className="bg-slate-200 px-1 rounded">{'{detalles_promocion}'}</code> - Detalles</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{fecha_vencimiento}'}</code> - Vencimiento</p>
                        <p><code className="bg-slate-200 px-1 rounded">{'{descuento}'}</code> - % o monto</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 pt-3 border-t">
                    💡 Usa estas variables en el asunto o cuerpo del email. Se reemplazarán automáticamente al enviar.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Variables usadas en esta plantilla</Label>
                <Input
                  value={formData.variables.join(', ')}
                  onChange={(e) => setFormData({
                    ...formData, 
                    variables: e.target.value.split(',').map(v => v.trim()).filter(v => v)
                  })}
                  placeholder="Ej: {cliente_nombre}, {tracking}"
                />
                <p className="text-xs text-slate-500">
                  Copia y pega las variables del glosario que uses en esta plantilla
                </p>
              </div>

              <div className="col-span-2 space-y-2">
                <Label>Asunto del Email *</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  placeholder="Asunto del email"
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
                        value={formData.body}
                        onChange={(content) => setFormData({ ...formData, body: content })}
                        modules={quillModules}
                        formats={quillFormats}
                        placeholder="Escribe tu mensaje aquí..."
                        className="bg-white"
                        style={{ minHeight: '250px' }}
                      />
                    </div>
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingTemplate ? 'Actualizar' : 'Crear'} Plantilla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewModal.open} onOpenChange={(open) => setPreviewModal({ open, template: null })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista Previa: {previewModal.template?.name}</DialogTitle>
          </DialogHeader>
          {previewModal.template && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-slate-600">Asunto:</Label>
                <p className="text-lg font-medium">{previewModal.template.subject}</p>
              </div>
              <div>
                <Label className="text-slate-600">Cuerpo:</Label>
                <div 
                  className="border rounded-lg p-4 bg-white"
                  dangerouslySetInnerHTML={{ __html: previewModal.template.body }}
                />
              </div>
              {previewModal.template.attachments?.length > 0 && (
                <div>
                  <Label className="text-slate-600">Adjuntos:</Label>
                  <div className="space-y-2 mt-2">
                    {previewModal.template.attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border">
                        <Paperclip className="h-4 w-4 text-slate-400" />
                        <p className="text-sm">{att.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}