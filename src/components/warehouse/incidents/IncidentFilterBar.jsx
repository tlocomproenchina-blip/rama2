import React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const EMPTY_FILTERS = { type: 'all', date: '', search: '' };

const TYPE_OPTIONS = [
  { value: 'faltante', label: 'Contenido faltante' },
  { value: 'danado', label: 'Paquete dañado' },
  { value: 'abierto', label: 'Caja abierta' },
  { value: 'cerrado', label: 'Cerrado para verificación' },
];

export default function IncidentFilterBar({ filters, onChange }) {
  const active = filters.type !== 'all' || filters.date || filters.search;
  const set = (patch) => onChange({ ...filters, ...patch });

  return (
    <div className="grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
      <div className="relative sm:col-span-2 lg:col-span-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Buscar por cliente, contenedor, tracking o código de bulto"
          className="pl-10"
        />
      </div>
      <Select value={filters.type} onValueChange={(v) => set({ type: v })}>
        <SelectTrigger><SelectValue placeholder="Tipo de incidencia" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input type="date" value={filters.date} onChange={(e) => set({ date: e.target.value })} aria-label="Fecha de reporte" />
      <Button type="button" variant="ghost" disabled={!active} onClick={() => onChange(EMPTY_FILTERS)}>
        <X className="mr-1 h-4 w-4" /> Limpiar
      </Button>
    </div>
  );
}