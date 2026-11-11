import React, { useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CUBIC_FEET_PER_CBM } from '@/lib/guideVolume';

// Línea de volumen de la guía (CBM y pies cúbicos) con lápiz para corregir el CBM.
// onSave(valor) recibe un número, o null para volver al valor calculado.
export default function GuideVolumeEditor({ label, cbm, edited, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const start = () => {
    setValue(cbm ? String(Number(cbm.toFixed(4))) : '');
    setEditing(true);
  };

  const save = async () => {
    const text = String(value).trim().replace(',', '.');
    const number = text === '' ? null : Number(text);
    if (number !== null && (!Number.isFinite(number) || number < 0)) return;
    setSaving(true);
    await onSave(number);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-700">
        <span>{label}:</span>
        <Input
          type="number"
          inputMode="decimal"
          step="0.001"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Vacío = valor calculado"
          className="h-8 w-40 text-xs"
          autoFocus
        />
        <span>CBM = {((Number(String(value).replace(',', '.')) || 0) * CUBIC_FEET_PER_CBM).toFixed(2)} pies cúbicos</span>
        <button type="button" onClick={save} disabled={saving} className="rounded-md p-1 text-emerald-700 hover:bg-emerald-50" aria-label="Guardar volumen">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={saving} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Cancelar">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-700">
      {label}: {cbm.toFixed(2)} CBM · {(cbm * CUBIC_FEET_PER_CBM).toFixed(2)} pies cúbicos
      {edited && <span className="rounded bg-amber-50 px-1 text-[10px] font-medium text-amber-700">editado</span>}
      <button type="button" onClick={start} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label={`Editar ${label.toLowerCase()}`}>
        <Pencil className="h-3 w-3" />
      </button>
    </p>
  );
}