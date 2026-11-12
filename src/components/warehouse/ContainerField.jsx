import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hash } from 'lucide-react';

export const CONTAINER_REQUIRED_MESSAGE = 'El N° de contenedor es obligatorio para guardar el bulto.';

// Convierte el texto del campo ("123, 456") en la lista de contenedores.
export const parseContainers = (text) =>
  String(text || '').split(',').map((s) => s.trim()).filter(Boolean);

// Campo del N° de contenedor con aviso de obligatorio junto al campo.
export default function ContainerField({ id, label = 'N° de contenedor', value, onChange, error, hint, disabled, placeholder = 'Ej: 12345 (separar con comas si son varios)' }) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600">
        <Hash className="h-3.5 w-3.5" /> {label} <span className="text-destructive">*</span>
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        className={error ? 'border-destructive focus-visible:ring-destructive/40' : ''}
      />
      {error
        ? <p className="mt-1 text-xs font-medium text-destructive">{error}</p>
        : hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}