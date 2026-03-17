import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

const emptyForm = {
  name: '',
  code: '',
  city: '',
  country: '',
  address: '',
  notes: '',
  is_active: true,
};

export default function WarehouseForm({ initialData, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    setForm(initialData ? {
      name: initialData.name || '',
      code: initialData.code || '',
      city: initialData.city || '',
      country: initialData.country || '',
      address: initialData.address || '',
      notes: initialData.notes || '',
      is_active: initialData.is_active !== false,
    } : emptyForm);
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      city: form.city.trim(),
      country: form.country.trim(),
      address: form.address.trim(),
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
          <Label>Ciudad</Label>
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
        </div>
        <div className="space-y-2">
          <Label>País</Label>
          <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Dirección</Label>
        <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <div className="flex items-center gap-3">
        <Checkbox checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked === true })} />
        <Label>Almacén activo</Label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  );
}