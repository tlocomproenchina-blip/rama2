import React, { useState } from 'react';
import { Tag, Plus, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { TAG_COLORS } from '@/lib/crmTags';

const COLORS = Object.keys(TAG_COLORS);

// El agente pone o quita etiquetas manuales y crea etiquetas nuevas del equipo.
export default function CrmTagsEditor({ client, manualTags = [], catalog = [], user, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');

  const save = async (tags) => {
    setSaving(true);
    const rows = await base44.entities.ClientTagAssignment.filter({ client_email: client.email }, '-updated_date', 1);
    const payload = {
      tags,
      client_name: client.full_name || client.email,
      shipping_mark: client.shipping_mark || '',
      updated_by_email: user?.email || '',
    };
    if (rows[0]) await base44.entities.ClientTagAssignment.update(rows[0].id, payload);
    else await base44.entities.ClientTagAssignment.create({ client_email: client.email, ...payload });
    await onSaved();
    setSaving(false);
  };

  const toggle = (name) => save(manualTags.includes(name) ? manualTags.filter((t) => t !== name) : [...manualTags, name]);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    if (!catalog.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      await base44.entities.ClientTag.create({ name, color: newColor, created_by_email: user?.email || '' });
    }
    setNewName('');
    await save([...new Set([...manualTags, name])]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline"><Tag className="h-4 w-4" /> Etiquetas</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <p className="text-xs font-semibold text-muted-foreground">Etiquetas del equipo</p>
        {catalog.length === 0 && <p className="text-xs text-muted-foreground">Aún no hay etiquetas. Crea la primera abajo.</p>}
        <div className="max-h-48 space-y-1.5 overflow-y-auto">
          {catalog.map((tag) => (
            <label key={tag.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={manualTags.includes(tag.name)} disabled={saving} onCheckedChange={() => toggle(tag.name)} />
              <span className={`rounded-full border px-2 py-0.5 text-xs ${TAG_COLORS[tag.color] || TAG_COLORS.blue}`}>{tag.name}</span>
            </label>
          ))}
        </div>
        <div className="space-y-2 border-t border-border pt-3">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nueva etiqueta" disabled={saving} />
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => setNewColor(c)}
                className={`h-5 w-5 rounded-full border ${TAG_COLORS[c]} ${newColor === c ? 'ring-2 ring-primary ring-offset-1' : ''}`} />
            ))}
            <Button size="sm" className="ml-auto" onClick={create} disabled={saving || !newName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}