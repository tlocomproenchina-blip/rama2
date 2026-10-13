import React from 'react';
import { Copy, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PortalExportBar({ selectedCount, allFiltered, resultados, loadedCount, onToggleAllFiltered, onExport, exporting }) {
  const exportingAll = allFiltered || selectedCount === 0;
  const scopeText = allFiltered
    ? `Se exportarán los ${Number(resultados || 0).toLocaleString('es-VE')} resultados filtrados`
    : selectedCount > 0
      ? `Se exportarán ${selectedCount} registro(s) seleccionado(s)`
      : `Se exportarán los ${Number(resultados || 0).toLocaleString('es-VE')} resultados filtrados`;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {selectedCount > 0 && !allFiltered
              ? `${selectedCount} registro(s) seleccionado(s)`
              : 'Sin selección: se usan todos los resultados filtrados'}
          </p>
          <p className="text-xs text-muted-foreground">{scopeText}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onToggleAllFiltered}
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              {allFiltered ? 'Quitar selección de todos los resultados' : `Seleccionar todos los resultados (${Number(resultados || 0).toLocaleString('es-VE')})`}
            </button>
            <span className="text-xs text-muted-foreground">{loadedCount} cargado(s) en pantalla</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => onExport('xlsx')}
            disabled={exporting}
            className="h-11 bg-slate-900 text-white hover:bg-slate-800"
          >
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Excel
          </Button>
          <Button type="button" variant="outline" onClick={() => onExport('csv')} disabled={exporting} className="h-11">
            {exportingAll ? <Download className="mr-2 h-4 w-4" /> : <FileText className="mr-2 h-4 w-4" />}
            CSV
          </Button>
          <Button type="button" variant="outline" onClick={() => onExport('copiar')} disabled={exporting} className="h-11">
            <Copy className="mr-2 h-4 w-4" />
            Copiar
          </Button>
        </div>
      </div>
    </section>
  );
}