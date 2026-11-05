import React, { useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Lista editable de los códigos agregados a mano (sin registro de paquete).
export default function UnregisteredCodesEditor({ codes, onChange }) {
  const [editing, setEditing] = useState(-1);
  const [draft, setDraft] = useState('');

  if (!codes.length) return null;

  const save = (index) => {
    const value = draft.trim();
    if (!value) return toast.error('El código no puede quedar vacío');
    if (codes.some((c, i) => i !== index && c.toUpperCase() === value.toUpperCase())) {
      return toast.error('Ese código ya está en el bulto');
    }
    onChange(codes.map((c, i) => (i === index ? value : c)));
    setEditing(-1);
  };

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-xs font-semibold text-slate-700">Códigos sin registrar ({codes.length})</p>
      {codes.map((code, i) => (
        <div key={`${code}-${i}`} className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-2 py-1">
          {editing === i ? (
            <>
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 font-mono text-xs" autoFocus />
              <Button size="sm" variant="outline" onClick={() => save(i)}><Check className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(-1)}><X className="h-3.5 w-3.5" /></Button>
            </>
          ) : (
            <>
              <span className="flex-1 break-all font-mono text-xs text-amber-900">{code}</span>
              <Button size="sm" variant="outline" onClick={() => { setEditing(i); setDraft(code); }}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <Button size="sm" variant="outline" className="text-red-600" onClick={() => onChange(codes.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" /> Quitar
              </Button>
            </>
          )}
        </div>
      ))}
      <p className="text-[10px] text-slate-400">Los cambios se aplican al guardar y ajustan el conteo de paquetes.</p>
    </div>
  );
}