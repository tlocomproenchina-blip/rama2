import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import ClientsDateRangeFilter from './ClientsDateRangeFilter';
import ClientsCategoryFilters from './ClientsCategoryFilters';

export default function ClientsFiltersPanel({
  fromDate, setFromDate, toDate, setToDate, quickDate, setQuickDate,
  exclusiveKey, counts, registeredCount,
  statusFilter, activeFilter, packageFilter, whatsappFilter,
  selectStatus, selectActive, selectPackage, selectWhatsapp,
  stateFilter, setStateFilter, stateConfigs, onResetFilters,
}) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 space-y-3">
        <ClientsDateRangeFilter
          fromDate={fromDate} setFromDate={setFromDate}
          toDate={toDate} setToDate={setToDate}
          quickDate={quickDate} setQuickDate={setQuickDate}
        />

        <ClientsCategoryFilters
          exclusiveKey={exclusiveKey}
          counts={counts}
          registeredCount={registeredCount}
          statusFilter={statusFilter}
          activeFilter={activeFilter}
          packageFilter={packageFilter}
          whatsappFilter={whatsappFilter}
          selectStatus={selectStatus}
          selectActive={selectActive}
          selectPackage={selectPackage}
          selectWhatsapp={selectWhatsapp}
        />

        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm text-slate-600">Estado:</span>
          <Select value={stateFilter} onValueChange={(v) => setStateFilter(v)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {stateConfigs.map((s) => (
                <SelectItem key={s.state_code} value={s.state_code}>{s.state_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={onResetFilters} className="ml-auto">Limpiar filtros</Button>
        </div>
      </CardContent>
    </Card>
  );
}