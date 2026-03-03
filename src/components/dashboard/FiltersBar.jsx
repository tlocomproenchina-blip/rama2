import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Filter } from "lucide-react";

export default function FiltersBar({ startDate, endDate, serviceType, onChange, onApply, loading }) {
  return (
    <div className="bg-white border rounded-xl shadow-sm p-3 md:p-4">
      <div className="flex items-center gap-2 mb-3 text-slate-600 text-sm">
        <Filter className="h-4 w-4" />
        <span>Filtros</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Desde</label>
          <Input
            type="date"
            value={startDate || ""}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Hasta</label>
          <Input
            type="date"
            value={endDate || ""}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Tipo de servicio</label>
          <Select value={serviceType} onValueChange={(v) => onChange({ serviceType: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="aereo">Aéreo</SelectItem>
              <SelectItem value="maritimo">Marítimo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button onClick={onApply} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}