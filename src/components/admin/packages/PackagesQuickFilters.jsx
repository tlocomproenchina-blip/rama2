import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Upload, Download } from 'lucide-react';

export default function PackagesQuickFilters({
  statusFilter,
  setStatusFilter,
  reportedFilter,
  setReportedFilter,
  globalCounts,
  onOpenCreate,
  onOpenImport,
  onExportPreAlerta,
}) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col lg:flex-row gap-4 flex-1 w-full">
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full lg:w-auto">
              <TabsList className="flex w-full gap-0 p-1 flex-wrap">
                <TabsTrigger value="all" className="flex-1 text-center">Todos{globalCounts ? ` (${globalCounts.total})` : ''}</TabsTrigger>
                <TabsTrigger value="pre_alerta_no_recibido" className="flex-1 text-center">Pre-alerta{globalCounts ? ` (${globalCounts.pre_alerta_no_recibido})` : ''}</TabsTrigger>
                <TabsTrigger value="recibido" className="flex-1 text-center">Recibido{globalCounts ? ` (${globalCounts.recibido})` : ''}</TabsTrigger>
                <TabsTrigger value="consolidado" className="flex-1 text-center">Consolidado{globalCounts ? ` (${globalCounts.consolidado})` : ''}</TabsTrigger>
                <TabsTrigger value="en_transito" className="flex-1 text-center">Tránsito{globalCounts ? ` (${globalCounts.en_transito})` : ''}</TabsTrigger>
                <TabsTrigger value="entregado" className="flex-1 text-center">Entregado{globalCounts ? ` (${globalCounts.entregado})` : ''}</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid w-full grid-cols-3 gap-2 lg:hidden">
              <Button variant={reportedFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setReportedFilter('all')} className="w-full">
                Todos
              </Button>
              <Button variant={reportedFilter === 'reported' ? 'default' : 'outline'} size="sm" onClick={() => setReportedFilter('reported')} className="w-full">
                Reportados
              </Button>
              <Button variant={reportedFilter === 'unreported' ? 'default' : 'outline'} size="sm" onClick={() => setReportedFilter('unreported')} className="w-full">
                No reportados
              </Button>
            </div>

            <div className="hidden lg:block">
              <Select value={reportedFilter} onValueChange={setReportedFilter}>
                <SelectTrigger className="w-full lg:w-48 bg-white">
                  <SelectValue placeholder="Reporte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="reported">Reportados</SelectItem>
                  <SelectItem value="unreported">No reportados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
            <Button onClick={onOpenCreate} size="sm" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
              <Package className="h-4 w-4 mr-2" />
              Registrar Paquete
            </Button>
            <Button onClick={onOpenImport} variant="outline" size="sm" className="w-full sm:w-auto">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button onClick={onExportPreAlerta} variant="outline" size="sm" className="w-full sm:w-auto border-blue-200 text-blue-600 hover:bg-blue-50">
              <Download className="h-4 w-4 mr-2" />
              Exportar Pre-alerta
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}