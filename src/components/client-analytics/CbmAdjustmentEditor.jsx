import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Ajuste manual que se suma al CBM total histórico del cliente.
export default function CbmAdjustmentEditor({ clientEmail, value, onSaved }) {
  const [draft, setDraft] = useState(String(value || 0));
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(String(value || 0)), [value]);

  const save = async () => {
    const num = Number(String(draft).replace(',', '.'));
    if (!Number.isFinite(num)) { toast.error('Ingresa un número válido'); return; }
    setSaving(true);
    const [u] = await base44.entities.User.filter({ email: clientEmail }, '-created_date', 1);
    if (!u) { setSaving(false); toast.error('No se encontró el cliente'); return; }
    await base44.entities.User.update(u.id, { cbm_historical_adjustment: num });
    setSaving(false);
    toast.success('Ajuste de CBM guardado');
    onSaved(num);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Ajuste histórico (CBM):</span>
      <Input className="h-9 w-32" value={draft} onChange={(e) => setDraft(e.target.value)} inputMode="decimal" />
      <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
    </div>
  );
}