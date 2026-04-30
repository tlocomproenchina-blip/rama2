import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, FileSpreadsheet } from 'lucide-react';

export default function BulkActionsBar({
  selectedCount,
  totalVisible,
  bulkAction,
  setBulkAction,
  bulkStatus,
  setBulkStatus,
  onApply,
  onCancel,
  onSelectAll,
  onCopySelectedByMark,
  onMarkReported,
  onExportExcel,
}) {
  return (
    <Card className="border-0 shadow-lg bg-blue-50">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedCount === totalVisible && totalVisible > 0}
              onCheckedChange={onSelectAll}
            />
            <span className="text-sm font-medium text-slate-700">
              {selectedCount} paquete(s) seleccionado(s)
            </span>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger className="w-48 bg-white">
                <SelectValue placeholder="Acción masiva" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Cambiar Estado</SelectItem>
                <SelectItem value="delete">Eliminar</SelectItem>
              </SelectContent>
            </Select>

            {bulkAction === 'status' && (
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-40 bg-white">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recibido">Recibido</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                  <SelectItem value="en_transito">En Tránsito</SelectItem>
                  <SelectItem value="disponible">Disponible</SelectItem>
                  <SelectItem value="entregado">Entregado</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button onClick={onApply} className="bg-blue-600 hover:bg-blue-700">
              Aplicar
            </Button>

            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>

            <Button variant="outline" onClick={onCopySelectedByMark} className="gap-2">
              <Copy className="h-4 w-4" /> Copiar Mark + Bultos
            </Button>

            <Button variant="outline" onClick={() => onMarkReported(true)}>
              Marcar reportados
            </Button>
            <Button variant="outline" onClick={() => onMarkReported(false)}>
              Quitar reporte
            </Button>

            {onExportExcel && (
              <Button variant="outline" onClick={onExportExcel} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}