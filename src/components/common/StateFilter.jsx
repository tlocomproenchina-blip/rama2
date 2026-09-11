import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin } from 'lucide-react';
import { CANONICAL_STATE_NAMES } from '@/components/utils/states';

/**
 * Filtro por estado derivado de los datos cargados.
 * extractState(item) devuelve el valor crudo del estado almacenado
 * (código lowercase o nombre); se normaliza a código lowercase.
 */
export default function StateFilter({ items, extractState, value, onChange, placeholder = 'Estado', className = 'w-full sm:w-44 shrink-0' }) {
  const stateOptions = useMemo(() => {
    const seen = new Map();
    (items || []).forEach((item) => {
      const raw = extractState(item);
      if (!raw) return;
      const code = String(raw).trim().toLowerCase();
      const name = CANONICAL_STATE_NAMES[code] || raw;
      const key = code || String(name).trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.set(key, { code: key, name });
    });
    return Array.from(seen.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
  }, [items, extractState]);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos los estados</SelectItem>
        {stateOptions.map((s) => (
          <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}