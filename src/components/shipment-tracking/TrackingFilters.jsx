import React from 'react';
import { Search, Download } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const statusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'en_transito', label: 'En Tránsito' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'entregado', label: 'Entregado' },
];

const typeOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'aereo', label: 'Aéreo' },
  { value: 'maritimo', label: 'Marítimo' },
];

export default function TrackingFilters({
  search,
  onSearchChange,
  filterStatus,
  onStatusChange,
  filterType,
  onTypeChange,
  showExport,
  onExport,
}) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por tracking, email o shipping mark..."
              className="h-11 rounded-xl border-slate-200 pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={filterStatus === option.value ? 'default' : 'outline'}
                onClick={() => onStatusChange(option.value)}
                className="rounded-xl"
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {typeOptions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={filterType === option.value ? 'default' : 'outline'}
                onClick={() => onTypeChange(option.value)}
                className="rounded-xl"
              >
                {option.label}
              </Button>
            ))}
          </div>

          {showExport && (
            <Button onClick={onExport} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}