import React from 'react';
import { Button } from "@/components/ui/button";
import { Upload, Download, ClipboardCopy } from 'lucide-react';
import ClientTxtReportButton from '@/components/admin/clients/ClientTxtReportButton';

export default function ClientsHeaderActions({
  canExport,
  onOpenImport,
  onExportFiltered,
  onCopyFiltered,
  onExportRemarketing,
  onReportChanged,
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gestión de Clientes</h1>
        <p className="text-slate-500">Administra los usuarios y asigna Shipping Marks</p>
      </div>
      {canExport && (
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={onOpenImport} variant="outline" className="w-full sm:w-auto">
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button
            onClick={onExportFiltered}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            title="Exporta los clientes según los filtros actuales"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar TXT
          </Button>
          <Button
            onClick={onCopyFiltered}
            variant="outline"
            className="w-full sm:w-auto border-blue-300 text-blue-700 hover:bg-blue-50"
            title="Copia los clientes filtrados al portapapeles (mismo formato TXT)"
          >
            <ClipboardCopy className="h-4 w-4 mr-2" />
            Copiar
          </Button>
          <Button
            onClick={onExportRemarketing}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar marketing WS
          </Button>
          <ClientTxtReportButton onReportChanged={onReportChanged} />
        </div>
      )}
    </div>
  );
}