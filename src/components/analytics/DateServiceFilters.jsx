import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Filter } from "lucide-react";

export default function DateServiceFilters({ value, onApply }) {
  const [startDate, setStartDate] = useState(value.startDate);
  const [endDate, setEndDate] = useState(value.endDate);
  const [service, setService] = useState(value.service || 'all');

  return (
    <div className="flex flex-col md:flex-row gap-3 md:items-end">
      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Calendar className="h-3 w-3"/>Desde</label>
        <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="border rounded px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Calendar className="h-3 w-3"/>Hasta</label>
        <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="border rounded px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Filter className="h-3 w-3"/>Servicio</label>
        <select value={service} onChange={(e)=>setService(e.target.value)} className="border rounded px-3 py-2 text-sm min-w-[160px]">
          <option value="all">Todos</option>
          <option value="aereo">Aéreo</option>
          <option value="maritimo">Marítimo</option>
        </select>
      </div>
      <div className="flex-1" />
      <Button onClick={() => onApply({ startDate, endDate, service })} className="self-start md:self-auto">Aplicar</Button>
    </div>
  );
}