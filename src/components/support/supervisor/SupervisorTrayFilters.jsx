import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FilterSelect = ({ value, onChange, placeholder, options }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>
      {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
    </SelectContent>
  </Select>
);

// Búsqueda y filtros de la bandeja del supervisor.
export default function SupervisorTrayFilters({ filters, setFilters, departments, admins }) {
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative flex-1 lg:min-w-[260px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set('search')(e.target.value)}
          placeholder="Buscar por N° de caso, asunto, cliente o responsable…"
        />
      </div>
      <FilterSelect value={filters.supervision} onChange={set('supervision')} placeholder="Supervisión" options={[
        { value: 'all', label: 'Toda supervisión' }, { value: 'pendiente', label: 'Pendientes' },
        { value: 'atendido', label: 'Atendidos' }, { value: 'none', label: 'Sin escalar' },
      ]} />
      <FilterSelect value={filters.priority} onChange={set('priority')} placeholder="Prioridad" options={[
        { value: 'all', label: 'Toda prioridad' }, { value: 'urgente', label: 'Urgente' }, { value: 'alta', label: 'Alta' },
        { value: 'media', label: 'Media' }, { value: 'baja', label: 'Baja' },
      ]} />
      <FilterSelect value={filters.department} onChange={set('department')} placeholder="Departamento" options={[
        { value: 'all', label: 'Todo departamento' }, { value: 'none', label: 'Sin departamento' },
        ...departments.map((d) => ({ value: d.id, label: d.name })),
      ]} />
      <FilterSelect value={filters.assignee} onChange={set('assignee')} placeholder="Responsable" options={[
        { value: 'all', label: 'Todo responsable' }, { value: 'none', label: 'Sin responsable' },
        ...admins.map((a) => ({ value: a.email, label: a.full_name || a.email })),
      ]} />
    </div>
  );
}