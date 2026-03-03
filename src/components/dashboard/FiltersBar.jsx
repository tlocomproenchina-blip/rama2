import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function FiltersBar({ filters, onChange }) {
  const handleDate = (key, value) => {
    onChange({ ...filters, [key]: value });
  };
  const handleService = (value) => {
    onChange({ ...filters, serviceType: value });
  };

  return (
    <div className="w-full bg-white border rounded-lg shadow-sm p-3 md:p-4 lg:p-5 mb-3 md:mb-4 lg:mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="space-y-1">
          <Label className="text-xs md:text-sm">Desde</Label>
          <Input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => handleDate('startDate', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs md:text-sm">Hasta</Label>
          <Input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => handleDate('endDate', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs md:text-sm">Tipo de servicio</Label>
          <Select value={filters.serviceType} onValueChange={handleService}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aereo">Aéreo</SelectItem>
              <SelectItem value="maritimo">Marítimo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}