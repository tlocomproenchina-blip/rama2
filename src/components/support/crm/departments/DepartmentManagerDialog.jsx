import React, { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEPARTMENT_COLORS, departmentDot } from '@/lib/departmentColors';

// Crear y eliminar los departamentos del tablero de casos.
export default function DepartmentManagerDialog({ open, onOpenChange, departments, onCreate, onRemove }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onCreate({ name, color });
    setName('');
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Departamentos</DialogTitle></DialogHeader>
        <ul className="max-h-64 space-y-1.5 overflow-y-auto">
          {departments.map((dep) => (
            <li key={dep.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className={`h-2.5 w-2.5 rounded-full ${departmentDot(dep.color)}`} /> {dep.name}
              </span>
              <Button size="icon" variant="ghost" onClick={() => onRemove(dep)} aria-label={`Eliminar ${dep.name}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
          {!departments.length && <p className="text-sm text-muted-foreground">Aún no hay departamentos.</p>}
        </ul>
        <form onSubmit={submit} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Facturación" />
          <Select value={color} onValueChange={setColor}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DEPARTMENT_COLORS).map(([key, c]) => (
                <SelectItem key={key} value={key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}