import React from 'react';
import { format } from 'date-fns';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const EMPTY_FILTERS = { client: 'all', type: 'all', date: '', search: '' };

const TYPE_OPTIONS = [
  { value: 'faltante', label: 'Contenido faltante' },
  { value: 'danado', label: 'Paquete dañado' },
  { value: 'abierto', label: 'Caja abierta para verificación' },
];

const clientKey = (i) => (i.client_email || i.client_code || i.client_name || '').toLowerCase();

// Clientes distintos presentes en las incidencias cargadas.
export function clientOptions(incidents = []) {
  const map = new Map();
  incidents.forEach((i) => {
    const key = clientKey(i);
    if (!key || map.has(key)) return;
    const name = i.client_name || i.client_email || i.client_code;
    map.set(key, i.client_code && i.client_name ? `${name} (${i.client_code})` : name);
  });
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Aplica cliente, tipo y fecha de reporte (día local) combinados.
export function applyIncidentFilters(incidents = [], f, labelByBulto = {}) {
  const q = (f.search || '').trim().toLowerCase();
  return incidents.filter((i) => {
    if (q) {
      const hay = [i.client_name, i.client_code, i.client_email, i.tracking_number, i.container_number, labelByBulto[i.bulto_id]]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.client !== 'all' && clientKey(i) !== f.client) return false;
    if (f.type !== 'all' && i.incident_type !== f.type) return false;
    if (f.date) {
      if (!i.reported_date) return false;
      if (format(new Date(i.reported_date), 'yyyy-MM-dd') !== f.date) return false;
    }
    return true;
  });
}

export default function IncidentFilterBar({ incidents, filters, onChange }) {
  const clients = clientOptions(incidents);
  const active = filters.client !== 'all' || filters.type !== 'all' || filters.date || filters.search;
  const set = (patch) => onChange({ ...filters, ...patch });

  return (
    <div className="grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]">
      <div className="relative sm:col-span-2 lg:col-span-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Buscar por cliente, tracking o código de bulto"
          className="pl-10"
        />
      </div>
      <Select value={filters.client} onValueChange={(v) => set({ client: v })}>
        <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los clientes</SelectItem>
          {clients.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
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