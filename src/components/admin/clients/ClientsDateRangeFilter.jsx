import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ClientsDateRangeFilter({
  fromDate, setFromDate,
  toDate, setToDate,
  quickDate, setQuickDate,
}) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">Filtrar por rango de fechas:</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Desde</span>
          <Input
            type="date"
            value={fromDate || ''}
            onChange={(e) => { setFromDate(e.target.value); setQuickDate('all'); }}
            className="w-auto"
          />
          <span className="text-xs text-slate-500">Hasta</span>
          <Input
            type="date"
            value={toDate || ''}
            onChange={(e) => { setToDate(e.target.value); setQuickDate('all'); }}
            className="w-auto"
          />
          {(fromDate || toDate) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setFromDate(''); setToDate(''); }}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant={quickDate === 'all' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickDate('all'); setFromDate(''); setToDate(''); }}>Todas</Button>
        <Button variant={quickDate === 'today' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickDate('today'); setFromDate(''); setToDate(''); }}>Hoy</Button>
        <Button variant={quickDate === '7d' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickDate('7d'); setFromDate(''); setToDate(''); }}>Últimos 7 días</Button>
        <Button variant={quickDate === '30d' ? 'default' : 'outline'} size="sm" onClick={() => { setQuickDate('30d'); setFromDate(''); setToDate(''); }}>Últimos 30 días</Button>
      </div>
    </div>
  );
}