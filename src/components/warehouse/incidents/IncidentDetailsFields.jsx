import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import MultiPhotoPicker from './MultiPhotoPicker';

const TYPES = [['abierto', 'Abierto'], ['faltante', 'Faltante'], ['danado', 'Dañado']];

// Campos que aparecen solo cuando se marca "Hay incidencia".
export default function IncidentDetailsFields({ type, onType, notes, onNotes, photos, onPhotos }) {
  return (
    <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50/50 p-3">
      <div className="space-y-1.5">
        <Label>Tipo de problema</Label>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map(([v, l]) => (
            <button key={v} type="button" onClick={() => onType(v)}
              className={`rounded-xl border px-2 py-2 text-sm font-medium ${type === v ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-border bg-card'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Detalle</Label>
        <Textarea rows={3} value={notes} onChange={(e) => onNotes(e.target.value)} placeholder="Qué no coincide con lo declarado…" />
      </div>
      <div className="space-y-1.5">
        <Label>Fotos adicionales (opcional)</Label>
        <MultiPhotoPicker files={photos} onChange={onPhotos} max={9} hint="La foto del contenido ya se incluye. Agrega más si hace falta; el cliente verá todas en su portal." />
      </div>
    </div>
  );
}