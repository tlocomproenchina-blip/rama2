import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, Search, X } from 'lucide-react';

export default function DispatchGuideFilters({ filters, onChange, onRefresh, loading }) {
  const hasFilters = Boolean(filters.from || filters.to || filters.search);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <Label className="text-xs text-slate-500">Desde</Label>
        <Input type="date" value={filters.from} onChange={(e) => onChange({ ...filters, from: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-slate-500">Hasta</Label>
        <Input type="date" value={filters.to} onChange={(e) => onChange({ ...filters, to: e.target.value })} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-xs text-slate-500">Cliente, mark, código de bulto o tracking</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-10"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Buscar escaneos…"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ from: '', to: '', search: '' })}>
            <X className="h-4 w-4" /> Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}