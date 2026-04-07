import React, { useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import SupportImageUploader from '@/components/support/SupportImageUploader';

const initialForm = {
  title: '',
  category: 'otro',
  message: '',
  image_urls: [],
  is_active: true,
  order: 0,
};

export default function AdminSupportQuickMessages() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);

  const loadItems = async () => {
    const data = await base44.entities.SupportQuickMessage.list('order');
    setItems(data);
  };

  useEffect(() => { loadItems(); }, []);

  const resetForm = () => {
    setEditing(null);
    setForm(initialForm);
    setOpen(false);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Completa título y mensaje');
      return;
    }

    if (editing) {
      await base44.entities.SupportQuickMessage.update(editing.id, form);
      toast.success('Mensaje actualizado');
    } else {
      await base44.entities.SupportQuickMessage.create(form);
      toast.success('Mensaje creado');
    }

    await loadItems();
    resetForm();
  };

  const handleEdit = (item) => {
    setEditing(item);
    setForm({
    title: item.title || '',
    category: item.category || 'otro',
    message: item.message || '',
    image_urls: item.image_urls || [],
    is_active: !!item.is_active,
    order: item.order || 0,
    });
    setOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este mensaje?')) return;
    await base44.entities.SupportQuickMessage.delete(id);
    toast.success('Mensaje eliminado');
    loadItems();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mensajes Predeterminados</h1>
          <p className="text-slate-500">Crea mensajes rápidos por categoría para soporte</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo mensaje
        </Button>
      </div>

      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id} className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <p className="text-sm text-slate-500 capitalize">{item.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={!!item.is_active} onCheckedChange={(checked) => base44.entities.SupportQuickMessage.update(item.id, { is_active: checked }).then(loadItems)} />
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{item.message}</p>
              {!!item.image_urls?.length && (
                <div className="flex flex-wrap gap-3">
                  {item.image_urls.map((url) => (
                    <img key={url} src={url} alt="Referencia" className="h-24 w-24 rounded-lg border object-cover" />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(value) => { if (!value) resetForm(); else setOpen(true); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar mensaje' : 'Nuevo mensaje'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saludo">Saludo</SelectItem>
                    <SelectItem value="seguimiento">Seguimiento</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="tracking">Tracking</SelectItem>
                    <SelectItem value="cierre">Cierre</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Orden</Label>
                <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mensaje</Label>
              <Textarea rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Imágenes opcionales</Label>
              <SupportImageUploader
                files={(form.image_urls || []).map((url, index) => ({ url, name: `imagen-${index + 1}` }))}
                onChange={(files) => setForm({ ...form, image_urls: files.map((file) => file.url).filter(Boolean) })}
                maxFiles={3}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Activo</Label>
              <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? 'Actualizar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}