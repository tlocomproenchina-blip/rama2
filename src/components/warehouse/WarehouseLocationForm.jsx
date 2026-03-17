import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const emptyForm = {
  name: '',
  code: '',
  zone: 'almacenamiento_general',
  type: 'estanteria',
  capacity_units: '',
  capacity_volume_cbm: '',
  capacity_weight_kg: '',
  notes: '',
  is_active: true,
};

const toNumber = (value) => value === '' ? undefined : Number(value);

export default function WarehouseLocationForm({ initialData, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    setForm(initialData ? {
      name: initialData.name || '',
      code: initialData.code || '',
      zone: initialData.zone || 'almacenamiento_general',
      type: initialData.type || 'estanteria',
      capacity_units: initialData.capacity_units ?? '',
      capacity_volume_cbm: initialData.capacity_volume_cbm ?? '',
      capacity_weight_kg: initialData.capacity_weight_kg ?? '',
      notes: initialData.notes || '',
      is_active: initialData.is_active !== false,
    } : emptyForm);
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      zone: form.zone,
      type: form.type,
      capacity_units: toNumber(form.capacity_units),
      capacity_volume_cbm: toNumber(form.capacity_volume_cbm),
      capacity_weight_kg: toNumber(form.capacity_weight_kg),
      notes: form.notes.trim(),
      is_active: form.is_active,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Nombre</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>Código</Label>
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required />
        </div>
        <div className="space-y-2">
          <Label>Zona</Label>
          <Select value={form.zone} onValueChange={(value) => setForm({ ...form, zone: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recepcion">Recepción</SelectItem>
              <SelectItem value="almacenamiento_general">Almacenamiento general</SelectItem>
              <SelectItem value="picking">Picking</SelectItem>
              <SelectItem value="despacho">Despacho</SelectItem>
              <SelectItem value="danados">Dañados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="estanteria">Estantería</SelectItem>
              <SelectItem value="piso">Piso</SelectItem>
              <SelectItem value="pallet_rack">Pallet rack</SelectItem>
              <SelectItem value="zona_granel">Zona granel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Capacidad paquetes</Label>
          <Input type="number" min="0" value={form.capacity_units} onChange={(e) => setForm({ ...form, capacity_units: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Capacidad CBM</Label>
          <Input type="number" min="0" step="0.001" value={form.capacity_volume_cbm} onChange={(e) => setForm({ ...form, capacity_volume_cbm: e.target.value })} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Capacidad peso (kg)</Label>
          <Input type="number" min="0" step="0.01" value={form.capacity_weight_kg} onChange={(e) => setForm({ ...form, capacity_weight_kg: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      <div className="flex items-center gap-3">
        <Checkbox checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked === true })} />
        <Label>Ubicación activa</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  );
}