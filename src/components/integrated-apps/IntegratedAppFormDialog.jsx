import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plug } from 'lucide-react';

export default function IntegratedAppFormDialog({ open, saving, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', contact_email: '', notes: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ name: '', contact_email: '', notes: '' });
      setError('');
    }
  }, [open]);

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError('Escribe el nombre de la copia');
      return;
    }
    setError('');
    onSubmit({
      name: form.name.trim(),
      contact_email: form.contact_email.trim(),
      notes: form.notes.trim()
    });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" /> Nueva app integrada
          </DialogTitle>
          <DialogDescription>
            Al crearla se genera su clave de acceso. Cópiala y guárdala en la copia: solo se muestra una vez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ia-name">Nombre de la copia</Label>
            <Input
              id="ia-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: TLEC Valencia"
            />
            {error && <p className="text-xs text-rose-500">{error}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ia-contact">Email de contacto (opcional)</Label>
            <Input
              id="ia-contact"
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              placeholder="responsable@correo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ia-notes">Notas (opcional)</Label>
            <Textarea
              id="ia-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ciudad, responsable, acuerdos…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</> : 'Crear y generar clave'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}