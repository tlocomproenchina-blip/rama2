import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, HelpCircle, Loader2, MoveUp, MoveDown, Search, Download } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

export default function AdminFAQ({ user }) {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: 'general',
    order: 0,
    is_active: true
  });

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    const data = await base44.entities.FAQ.list('order');
    setFaqs(data);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.question || !formData.answer) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      if (editingFaq) {
        await base44.entities.FAQ.update(editingFaq.id, formData);
        toast.success('FAQ actualizado');
      } else {
        await base44.entities.FAQ.create(formData);
        toast.success('FAQ creado');
      }
      loadFAQs();
      handleClose();
    } catch (error) {
      toast.error('Error al guardar');
    }
  };

  const handleEdit = (faq) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      order: faq.order,
      is_active: faq.is_active
    });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta pregunta?')) return;
    try {
      await base44.entities.FAQ.delete(id);
      toast.success('FAQ eliminado');
      loadFAQs();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleToggleActive = async (faq) => {
    try {
      await base44.entities.FAQ.update(faq.id, { is_active: !faq.is_active });
      toast.success(faq.is_active ? 'FAQ desactivado' : 'FAQ activado');
      loadFAQs();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const handleReorder = async (faq, direction) => {
    const newOrder = direction === 'up' ? faq.order - 1 : faq.order + 1;
    try {
      await base44.entities.FAQ.update(faq.id, { order: newOrder });
      loadFAQs();
    } catch (error) {
      toast.error('Error al reordenar');
    }
  };

  const handleClose = () => {
    setShowDialog(false);
    setEditingFaq(null);
    setFormData({
      question: '',
      answer: '',
      category: 'general',
      order: 0,
      is_active: true
    });
  };

  const handleExportPDF = () => {
    const list = filteredFaqs;
    if (list.length === 0) {
      toast.error('No hay preguntas para exportar');
      return;
    }
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginL = 18;
    const maxW = pageWidth - marginL * 2;
    let y = 22;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text('Preguntas Frecuentes', marginL, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generado el ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`, marginL, y);
    y += 10;

    const ensureSpace = (needed) => {
      if (y + needed > pageHeight - 18) {
        doc.addPage();
        y = 22;
      }
    };

    list.forEach((faq, idx) => {
      const qLines = doc.splitTextToSize(`${idx + 1}. ${faq.question}`, maxW);
      const aLines = doc.splitTextToSize(faq.answer || '', maxW);
      ensureSpace(qLines.length * 6 + aLines.length * 5 + 12);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(31, 41, 55);
      qLines.forEach((line) => { doc.text(line, marginL, y); y += 6; });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      aLines.forEach((line) => { doc.text(line, marginL, y); y += 5; });
      y += 7;
    });

    doc.save('preguntas-frecuentes.pdf');
    toast.success('PDF generado');
  };

  const categoryLabels = {
    general: 'General',
    envios: 'Envíos',
    pagos: 'Pagos',
    tracking: 'Tracking',
    consolidacion: 'Consolidación'
  };

  const categoryColors = {
    general: 'bg-slate-100 text-slate-800',
    envios: 'bg-blue-100 text-blue-800',
    pagos: 'bg-green-100 text-green-800',
    tracking: 'bg-purple-100 text-purple-800',
    consolidacion: 'bg-orange-100 text-orange-800'
  };

  const normalizeText = (text) => String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '');

  const filteredFaqs = faqs.filter((faq) => {
    const query = normalizeText(search);
    if (!query) return true;
    return normalizeText(faq.question).includes(query) || normalizeText(faq.answer).includes(query);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Preguntas Frecuentes</h1>
          <p className="text-slate-500">Gestiona las FAQ que verán los clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          <Button onClick={() => setShowDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Pregunta
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por pregunta o respuesta..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {filteredFaqs.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HelpCircle className="h-16 w-16 text-slate-300 mb-4" />
            <p className="text-slate-500 text-center">
              {search ? 'No se encontraron preguntas con ese criterio.' : 'No hay preguntas frecuentes.\nCrea la primera pregunta para tus clientes.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredFaqs.map((faq) => (
            <Card key={faq.id} className={`border-0 shadow-lg ${!faq.is_active ? 'opacity-60' : ''}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={categoryColors[faq.category]}>
                        {categoryLabels[faq.category]}
                      </Badge>
                      <span className="text-xs text-slate-400">Orden: {faq.order}</span>
                    </div>
                    <CardTitle className="text-lg text-slate-800">{faq.question}</CardTitle>
                    <CardDescription className="mt-2 text-slate-600">{faq.answer}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Switch
                      checked={faq.is_active}
                      onCheckedChange={() => handleToggleActive(faq)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleReorder(faq, 'up')}>
                      <MoveUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleReorder(faq, 'down')}>
                      <MoveDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(faq)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(faq.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingFaq ? 'Editar Pregunta Frecuente' : 'Nueva Pregunta Frecuente'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pregunta</Label>
              <Input
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                placeholder="¿Cómo funciona el proceso de consolidación?"
              />
            </div>

            <div className="space-y-2">
              <Label>Respuesta</Label>
              <Textarea
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                placeholder="Escribe la respuesta detallada..."
                rows={6}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="envios">Envíos</SelectItem>
                    <SelectItem value="pagos">Pagos</SelectItem>
                    <SelectItem value="tracking">Tracking</SelectItem>
                    <SelectItem value="consolidacion">Consolidación</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Orden</Label>
                <Input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Pregunta activa (visible para clientes)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
              {editingFaq ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}