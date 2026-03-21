import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function CreateConversationDialog({ open, onOpenChange, packages, routes, onCreate }) {
  const [form, setForm] = useState({ entity_type: 'Package', entity_id: '', title: '', topic: '', target_area: 'all', first_message: '' });
  const [recordSearch, setRecordSearch] = useState('');
  const options = useMemo(() => form.entity_type === 'Package' ? packages : routes, [form.entity_type, packages, routes]);
  const filteredOptions = useMemo(() => {
    const term = String(recordSearch || '').toLowerCase();
    return options.filter((item) => !term || String(item.searchText || item.label || '').toLowerCase().includes(term));
  }, [options, recordSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Nueva conversación interna</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Departamento</Label><Select value={form.target_area} onValueChange={(value) => setForm({ ...form, target_area: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Cualquier departamento</SelectItem><SelectItem value="operaciones">Operaciones</SelectItem><SelectItem value="almacen">Almacén</SelectItem><SelectItem value="contabilidad">Contabilidad</SelectItem><SelectItem value="soporte">Soporte</SelectItem><SelectItem value="marketing">Marketing</SelectItem><SelectItem value="logistica">Logística</SelectItem><SelectItem value="comunicaciones">Comunicaciones</SelectItem><SelectItem value="seguimiento">Seguimiento</SelectItem><SelectItem value="equipo_y_acceso">Equipo y Acceso</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Relacionado con</Label><Select value={form.entity_type} onValueChange={(value) => setForm({ ...form, entity_type: value, entity_id: '', title: form.title, topic: form.topic, target_area: form.target_area, first_message: form.first_message })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Package">Paquete</SelectItem><SelectItem value="Ruta">Ruta</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-2">
            <Label>Buscar {form.entity_type === 'Package' ? 'paquete' : 'ruta'}</Label>
            <Input value={recordSearch} onChange={(e) => setRecordSearch(e.target.value)} placeholder={form.entity_type === 'Package' ? 'Tracking, nombre cliente, shipping mark o teléfono' : 'Código o nombre de ruta'} />
          </div>
          <div className="space-y-2"><Label>{form.entity_type === 'Package' ? 'Paquete' : 'Ruta'}</Label><Select value={form.entity_id} onValueChange={(value) => setForm({ ...form, entity_id: value })}><SelectTrigger><SelectValue placeholder="Selecciona un registro" /></SelectTrigger><SelectContent>{filteredOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Incidencia con paquete recibido" /></div>
          <div className="space-y-2"><Label>Contexto</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Resumen corto del problema" /></div>
          <div className="space-y-2"><Label>Primer mensaje</Label><Textarea value={form.first_message} onChange={(e) => setForm({ ...form, first_message: e.target.value })} rows={4} placeholder="Describe lo que necesita el equipo" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onCreate(form, options.find((item) => item.id === form.entity_id))} disabled={!form.entity_id || !form.title.trim() || !form.first_message.trim()} className="bg-blue-600 hover:bg-blue-700">Crear conversación</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}