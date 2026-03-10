import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X, Filter, Calendar } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function AdvancedSearch({ type, onSearch, onReset }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState({
    tracking: '',
    email: '',
    shippingMark: '',
    status: 'all',
    shippingType: 'all',
    dateFrom: '',
    dateTo: '',
    receivedDateFrom: '',
    receivedDateTo: '',
    hasInsurance: 'all',
    minAmount: '',
    maxAmount: ''
  });

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleReset = () => {
    const resetFilters = {
      tracking: '',
      email: '',
      shippingMark: '',
      status: 'all',
      shippingType: 'all',
      dateFrom: '',
      dateTo: '',
      receivedDateFrom: '',
      receivedDateTo: '',
      hasInsurance: 'all',
      minAmount: '',
      maxAmount: ''
    };
    setFilters(resetFilters);
    onReset();
  };

  const getStatusOptions = () => {
    if (type === 'packages') {
      return [
        { value: 'all', label: 'Todos los estados' },
        { value: 'pre_alerta', label: 'Pre-alerta' },
        { value: 'recibido', label: 'Recibido' },
        { value: 'consolidado', label: 'Consolidado' },
        { value: 'en_transito', label: 'En Tránsito' },
        { value: 'disponible', label: 'Disponible' },
        { value: 'entregado', label: 'Entregado' }
      ];
    } else if (type === 'consolidations') {
      return [
        { value: 'all', label: 'Todos los estados' },
        { value: 'en_transito', label: 'En Tránsito' },
        { value: 'pago_validado', label: 'Pago Validado' },
        { value: 'disponible', label: 'Disponible' },
        { value: 'entregado', label: 'Entregado' }
      ];
    } else if (type === 'invoices') {
      return [
        { value: 'all', label: 'Todos los estados' },
        { value: 'pendiente', label: 'Pendiente' },
        { value: 'pagada', label: 'Pagada' },
        { value: 'vencida', label: 'Vencida' },
        { value: 'cancelada', label: 'Cancelada' }
      ];
    }
    return [];
  };

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-slate-600" />
              <h3 className="font-semibold text-slate-800">Búsqueda Avanzada</h3>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? 'Ocultar' : 'Mostrar'} filtros
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="space-y-4">
            {/* Quick search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Número de Tracking</Label>
                <Input
                  placeholder="Ej: 1234567890"
                  value={filters.tracking}
                  onChange={(e) => setFilters({ ...filters, tracking: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Email del Cliente</Label>
                <Input
                  placeholder="cliente@email.com"
                  value={filters.email}
                  onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Shipping Mark</Label>
                <Input
                  placeholder="TLEC-XXXX"
                  value={filters.shippingMark}
                  onChange={(e) => setFilters({ ...filters, shippingMark: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Status and Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Estado</Label>
                <Select value={filters.status} onValueChange={(val) => setFilters({ ...filters, status: val })}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getStatusOptions().map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(type === 'packages' || type === 'consolidations') && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-600">Tipo de Envío</Label>
                  <Select value={filters.shippingType} onValueChange={(val) => setFilters({ ...filters, shippingType: val })}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los tipos</SelectItem>
                      <SelectItem value="aereo">Aéreo</SelectItem>
                      <SelectItem value="maritimo">Marítimo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {type === 'packages' && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-600">Seguro</Label>
                  <Select value={filters.hasInsurance} onValueChange={(val) => setFilters({ ...filters, hasInsurance: val })}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="true">Con seguro</SelectItem>
                      <SelectItem value="false">Sin seguro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Date Range - Registro */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-600 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Fecha de Registro (Desde)
                </Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-600 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Fecha de Registro (Hasta)
                </Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Date Range - Recepción (solo Paquetes) */}
            {type === 'packages' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-600 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Fecha de Recepción (Desde)
                  </Label>
                  <Input
                    type="date"
                    value={filters.receivedDateFrom}
                    onChange={(e) => setFilters({ ...filters, receivedDateFrom: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-600 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Fecha de Recepción (Hasta)
                  </Label>
                  <Input
                    type="date"
                    value={filters.receivedDateTo}
                    onChange={(e) => setFilters({ ...filters, receivedDateTo: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* Amount Range (for invoices and consolidations) */}
            {(type === 'invoices' || type === 'consolidations') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-600">Monto Mínimo (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={filters.minAmount}
                    onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-600">Monto Máximo (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={filters.maxAmount}
                    onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 flex-1">
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
              <Button onClick={handleReset} variant="outline" className="flex-1">
                <X className="h-4 w-4 mr-2" />
                Limpiar Filtros
              </Button>
            </div>

            {/* Active Filters Summary */}
            {Object.values(filters).some(v => v && v !== 'all') && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-medium text-blue-800 mb-2">Filtros activos:</p>
                <div className="flex flex-wrap gap-2">
                  {filters.tracking && (
                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                      Tracking: {filters.tracking}
                    </span>
                  )}
                  {filters.email && (
                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                      Email: {filters.email}
                    </span>
                  )}
                  {filters.shippingMark && (
                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                      Mark: {filters.shippingMark}
                    </span>
                  )}
                  {filters.status !== 'all' && (
                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                      Estado: {filters.status}
                    </span>
                  )}
                  {filters.shippingType !== 'all' && (
                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                      Tipo: {filters.shippingType}
                    </span>
                  )}
                  {filters.dateFrom && (
                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                      Reg. desde: {filters.dateFrom}
                    </span>
                  )}
                  {filters.dateTo && (
                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                      Reg. hasta: {filters.dateTo}
                    </span>
                  )}
                  {filters.receivedDateFrom && (
                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                      Rec. desde: {filters.receivedDateFrom}
                    </span>
                  )}
                  {filters.receivedDateTo && (
                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                      Rec. hasta: {filters.receivedDateTo}
                    </span>
                  )}
                  {filters.minAmount && (
                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                      Min: ${filters.minAmount}
                    </span>
                  )}
                  {filters.maxAmount && (
                    <span className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                      Max: ${filters.maxAmount}
                    </span>
                  )}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}