import React from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AUTO_TAGS } from '@/lib/crmTags';

// Filtros de la bandeja: por etiqueta del cliente y solo mis tareas.
export default function CrmTagFilter({ value, onChange, catalog = [], mine, onMineChange }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? '' : v)}>
        <SelectTrigger className="sm:w-60"><SelectValue placeholder="Filtrar por etiqueta" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las etiquetas</SelectItem>
          <SelectGroup>
            <SelectLabel>Automáticas</SelectLabel>
            {Object.entries(AUTO_TAGS).map(([key, meta]) => (
              <SelectItem key={key} value={`auto:${key}`}>{meta.label}</SelectItem>
            ))}
          </SelectGroup>
          {catalog.length > 0 && (
            <SelectGroup>
              <SelectLabel>Del equipo</SelectLabel>
              {catalog.map((tag) => (
                <SelectItem key={tag.id} value={`manual:${tag.name}`}>{tag.name}</SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={mine} onCheckedChange={onMineChange} /> Solo mis tareas
      </label>
    </div>
  );
}