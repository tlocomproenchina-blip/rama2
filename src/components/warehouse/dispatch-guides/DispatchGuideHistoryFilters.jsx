import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, Search, X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'emitida', label: 'Pendientes de entrega' },
  { value: 'entregada', label: 'Entregadas' },
];

export default function DispatchGuideHistoryFilters({ filters, onChange, onRefresh, loading }) {
  const hasFilters = Boolean(filters.from || filters.to || filters.search || filters.status !== 'all');

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Desde</Label>
          <Input type="date" value={filters.from} onChange={(e) => onChange({ ...filters, from: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Hasta</Label>
          <Input type="date" value={filters.to} onChange={(e) => onChange({ ...filters, to: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Estado de entrega</Label>
          <select
            value={filters.status}
            onChange={(e) => onChange({ ...filters, status: e.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-slate-700 sm:h-10"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-slate-500">Número de guía, cliente, mark o código de bulto</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-10"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Buscar guías emitidas…"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ from: '', to: '', search: '', status: 'all' })}>
            <X className="h-4 w-4" /> Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}