import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Filter } from "lucide-react";

export default function DateServiceFilters({ value, onApply }) {
  const [startDate, setStartDate] = useState(value.startDate);
  const [endDate, setEndDate] = useState(value.endDate);
  const [service, setService] = useState(value.service || 'all');

  const setPreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(start.toISOString().slice(0,10));
    setEndDate(end.toISOString().slice(0,10));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Calendar className="h-3 w-3"/>Desde</label>
          <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Calendar className="h-3 w-3"/>Hasta</label>
          <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Filter className="h-3 w-3"/>Servicio</label>
          <select value={service} onChange={(e)=>setService(e.target.value)} className="border rounded-xl px-3 py-2 text-sm min-w-[160px] focus:ring-2 focus:ring-blue-200 outline-none">
            <option value="all">Todos</option>
            <option value="aereo">Aéreo</option>
            <option value="maritimo">Marítimo</option>
          </select>
        </div>
        <div className="flex-1" />
        <Button onClick={() => onApply({ startDate, endDate, service })} className="self-start md:self-auto rounded-xl">Aplicar</Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        Rango rápido:
        <button onClick={() => setPreset(7)} className="px-2 py-1 rounded-full border hover:bg-slate-50">7d</button>
        <button onClick={() => setPreset(30)} className="px-2 py-1 rounded-full border hover:bg-slate-50">30d</button>
        <button onClick={() => setPreset(90)} className="px-2 py-1 rounded-full border hover:bg-slate-50">90d</button>
      </div>
    </div>
  );
}