import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, Search, X, Package, Upload, Download, Loader2 } from 'lucide-react';

const EMPTY_FORM = {
  tracking: '',
  email: '',
  shippingMark: '',
  shippingType: 'all',
  dateFrom: '',
  dateTo: '',
  hasInsurance: 'all',
};

const STATUS_TABS = [
  { value: 'all', label: 'Todos', countKey: 'total' },
  { value: 'pre_alerta_no_recibido', label: 'Pre-alerta', countKey: 'pre_alerta_no_recibido' },
  { value: 'recibido', label: 'Recibido', countKey: 'recibido' },
  { value: 'consolidado', label: 'Consolidado', countKey: 'consolidado' },
  { value: 'en_transito', label: 'Tránsito', countKey: 'en_transito' },
  { value: 'entregado', label: 'Entregado', countKey: 'entregado' },
];

export default function PackagesSearchBar({
  statusFilter,
  setStatusFilter,
  reportedFilter,
  setReportedFilter,
  advancedFilters,
  setAdvancedFilters,
  globalCounts,
  loading,
  onReset,
  onOpenCreate,
  onOpenImport,
  onExportPreAlerta,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // Sync form con advancedFilters del hook cuando cambian externamente (ej: reset)
  useEffect(() => {
    if (!advancedFilters) {
      setForm(EMPTY_FORM);
    }
  }, [advancedFilters]);

  const hasAdvanced = advancedFilters && Object.values(advancedFilters).some(
    (v) => v && v !== 'all' && v !== ''
  );

  const handleApply = () => {
    const cleaned = {};
    Object.entries(form).forEach(([k, v]) => {
      cleaned[k] = v || (k === 'shippingType' || k === 'hasInsurance' ? 'all' : '');
    });
    setAdvancedFilters(cleaned);
  };

  const handleClear = () => {
    setForm(EMPTY_FORM);
    setAdvancedFilters(null);
    onReset();
  };

  return (
    <div className="space-y-3">
      {/* === Pestañas de estado con conteos === */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.value;
          const count = globalCounts?.[tab.countKey] ?? 0;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* === Barra de carga === */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
          <span>Cargando paquetes…</span>
          <div className="flex-1 h-1 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full w-1/3 bg-blue-600 rounded-full animate-[loading-bar_1.2s_ease-in-out_infinite]" />
          </div>
        </div>
      )}

      {/* === Toggle filtros avanzados + acciones === */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="gap-1.5"
        >
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Filtros avanzados
          {hasAdvanced && <span className="ml-1 h-2 w-2 rounded-full bg-blue-500" />}
        </Button>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <Button onClick={onOpenCreate} size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1.5">
            <Package className="h-4 w-4" />
            Registrar
          </Button>
          <Button onClick={onOpenImport} variant="outline" size="sm" className="gap-1.5">
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          <Button
            onClick={onExportPreAlerta}
            variant="outline"
            size="sm"
            className="gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* === Panel de filtros avanzados === */}
      {showAdvanced && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm">
          {/* Campos de texto */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Tracking</Label>
              <Input
                value={form.tracking}
                onChange={(e) => setForm({ ...form, tracking: e.target.value })}
                className="text-sm h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="text-sm h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Shipping Mark</Label>
              <Input
                value={form.shippingMark}
                onChange={(e) => setForm({ ...form, shippingMark: e.target.value })}
                className="text-sm h-9"
              />
            </div>
          </div>

          {/* Selects */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Tipo de envío</Label>
              <Select
                value={form.shippingType}
                onValueChange={(v) => setForm({ ...form, shippingType: v })}
              >
                <SelectTrigger className="text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="aereo">Aéreo</SelectItem>
                  <SelectItem value="maritimo">Marítimo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Seguro</Label>
              <Select
                value={form.hasInsurance}
                onValueChange={(v) => setForm({ ...form, hasInsurance: v })}
              >
                <SelectTrigger className="text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Con seguro</SelectItem>
                  <SelectItem value="false">Sin seguro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Reportado</Label>
              <Select
                value={reportedFilter || 'all'}
                onValueChange={(v) => setReportedFilter(v)}
              >
                <SelectTrigger className="text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="reported">Reportados</SelectItem>
                  <SelectItem value="unreported">No reportados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Desde</Label>
              <Input
                type="date"
                value={form.dateFrom}
                onChange={(e) => setForm({ ...form, dateFrom: e.target.value })}
                className="text-sm h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Hasta</Label>
              <Input
                type="date"
                value={form.dateTo}
                onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
                className="text-sm h-9"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            <Button onClick={handleApply} className="bg-blue-600 hover:bg-blue-700 flex-1 gap-1.5">
              <Search className="h-4 w-4" />
              Aplicar filtros
            </Button>
            <Button onClick={handleClear} variant="outline" className="flex-1 gap-1.5">
              <X className="h-4 w-4" />
              Limpiar todo
            </Button>
          </div>

          {/* Filtros activos */}
          {hasAdvanced && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs font-medium text-slate-500 py-1">Activos:</span>
              {advancedFilters.tracking && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">
                  Tracking: {advancedFilters.tracking}
                </span>
              )}
              {advancedFilters.email && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">
                  Email: {advancedFilters.email}
                </span>
              )}
              {advancedFilters.shippingMark && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">
                  Mark: {advancedFilters.shippingMark}
                </span>
              )}
              {advancedFilters.shippingType && advancedFilters.shippingType !== 'all' && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">
                  Tipo: {advancedFilters.shippingType}
                </span>
              )}
              {advancedFilters.hasInsurance && advancedFilters.hasInsurance !== 'all' && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">
                  Seguro: {advancedFilters.hasInsurance === 'true' ? 'Con' : 'Sin'}
                </span>
              )}
              {advancedFilters.dateFrom && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">
                  Desde: {advancedFilters.dateFrom}
                </span>
              )}
              {advancedFilters.dateTo && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">
                  Hasta: {advancedFilters.dateTo}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}