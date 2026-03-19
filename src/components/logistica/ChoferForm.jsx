import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ChoferForm({ value, onChange }) {
  return (
    <div className="grid gap-4 py-2 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Nombres</Label>
        <Input value={value.nombres} onChange={(e) => onChange({ ...value, nombres: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Apellidos</Label>
        <Input value={value.apellidos} onChange={(e) => onChange({ ...value, apellidos: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Cédula</Label>
        <Input value={value.cedula} onChange={(e) => onChange({ ...value, cedula: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Teléfono</Label>
        <Input value={value.telefono} onChange={(e) => onChange({ ...value, telefono: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Licencia</Label>
        <Input value={value.licencia} onChange={(e) => onChange({ ...value, licencia: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Categoría licencia</Label>
        <Input value={value.categoria_licencia} onChange={(e) => onChange({ ...value, categoria_licencia: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Vencimiento licencia</Label>
        <Input type="date" value={value.fecha_vencimiento_licencia} onChange={(e) => onChange({ ...value, fecha_vencimiento_licencia: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Estado</Label>
        <Select value={value.estado} onValueChange={(estado) => onChange({ ...value, estado })}>
          <SelectTrigger><SelectValue placeholder="Selecciona estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="disponible">Disponible</SelectItem>
            <SelectItem value="en_ruta">En ruta</SelectItem>
            <SelectItem value="suspendido">Suspendido</SelectItem>
            <SelectItem value="inactivo">Inactivo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Dirección</Label>
        <Input value={value.direccion} onChange={(e) => onChange({ ...value, direccion: e.target.value })} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Observaciones</Label>
        <Textarea value={value.observaciones} onChange={(e) => onChange({ ...value, observaciones: e.target.value })} />
      </div>
    </div>
  );
}