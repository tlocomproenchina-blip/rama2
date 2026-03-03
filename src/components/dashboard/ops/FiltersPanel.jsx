import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Calendar, Filter, RotateCcw } from 'lucide-react';

export default function FiltersPanel({ filters, setFilters, services, onReset }) {
  const { startDate, endDate, service } = filters;
  return (
    <div className="rounded-2xl border bg-white/80 backdrop-blur p-4 md:p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <Filter className="h-4 w-4 text-slate-500" />
        <p className="font-semibold text-slate-800">Filtros</p>
      </div>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 md:col-span-3">
          <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Calendar className="h-3 w-3"/> Inicio</div>
          <Input type="date" value={startDate || ''} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
        </div>
        <div className="col-span-12 md:col-span-3">
          <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Calendar className="h-3 w-3"/> Fin</div>
          <Input type="date" value={endDate || ''} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
        </div>
        <div className="col-span-12 md:col-span-4">
          <div className="text-xs text-slate-500 mb-1">Servicio</div>
          <Select value={service || 'All'} onValueChange={(v) => setFilters((f) => ({ ...f, service: v }))}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {services.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-12 md:col-span-2 flex items-end">
          <Button variant="outline" className="w-full" onClick={onReset}>
            <RotateCcw className="h-4 w-4 mr-2"/> Reset
          </Button>
        </div>
      </div>
    </div>
  );
}