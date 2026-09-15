import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, XCircle, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function CbmImportDialog({ open, onOpenChange, onDone }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setUploading(false);
    setProcessing(false);
  };

  const handleClose = (open) => {
    if (!open) {
      reset();
      onOpenChange?.(open);
    } else {
      onOpenChange?.(open);
    }
  };

  const handleFileSelect = (selected) => {
    const f = selected?.[0] || selected;
    if (!f) return;
    const validTypes = ['.xlsx', '.xls', '.csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
    const name = (f.name || '').toLowerCase();
    const ok = validTypes.some(t => name.endsWith(t) || f.type === t);
    if (!ok) {
      toast.error('Solo se aceptan archivos Excel (.xlsx, .xls) o CSV');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleProcess = async () => {
    if (!file) return;
    setProcessing(true);
    setUploading(true);
    try {
      // 1. Subir archivo a almacenamiento público
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
      const fileUrl = uploadRes?.file_url;
      if (!fileUrl) {
        toast.error('No se pudo subir el archivo');
        setProcessing(false);
        setUploading(false);
        return;
      }
      setUploading(false);

      // 2. Invocar función backend
      const res = await base44.functions.invoke('importCbmIngresosFromExcel', { file_url: fileUrl });
      const data = res?.data || res;
      if (data?.error) {
        toast.error(data.error);
        setProcessing(false);
        return;
      }
      setResult(data);
      toast.success(`${data.created || 0} recibo(s) creado(s)`);
      if (data.created > 0) onDone?.();
    } catch (e) {
      toast.error('Error al procesar: ' + (e?.message || ''));
    }
    setProcessing(false);
  };

  const downloadReport = () => {
    if (!result) return;
    const lines = ['REPORTE DE IMPORTACIÓN CBM', `Total filas: ${result.total}`, `Creados: ${result.created}`, `Saltados (ya existen): ${result.skipped}`, `No encontrados: ${result.notFound}`, '', ''];
    if (result.createdDetails?.length) {
      lines.push('=== CREADOS ===');
      lines.push('Shipping Mark\tRecibo\tCBM\tFecha Salida\tCliente');
      result.createdDetails.forEach(r => lines.push(`${r.shipping_mark}\t${r.invoice_number}\t${r.cbm}\t${r.fecha_salida}\t${r.client_name}`));
      lines.push('');
    }
    if (result.skippedDetails?.length) {
      lines.push('=== SALTADOS (ya existen) ===');
      lines.push('Shipping Mark\tRecibo\tCBM\tFecha Salida\tCliente');
      result.skippedDetails.forEach(r => lines.push(`${r.shipping_mark}\t${r.invoice_number}\t${r.cbm}\t${r.fecha_salida}\t${r.client_name}`));
      lines.push('');
    }
    if (result.notFoundDetails?.length) {
      lines.push('=== NO ENCONTRADOS ===');
      lines.push('Shipping Mark\tRecibo\tCBM\tFecha Salida\tMotivo');
      result.notFoundDetails.forEach(r => lines.push(`${r.shipping_mark || ''}\t${r.invoice_number || ''}\t${r.cbm || ''}\t${r.fecha_salida || ''}\t${r.reason || ''}`));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_importacion_cbm_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Importar Recibos CBM desde Excel
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Sube un archivo Excel o CSV con las columnas: <strong>SHIPPING MARK</strong>, <strong>Ordenes/RECIBO</strong>, <strong>CBM</strong>, <strong>Fecha De SALIDA</strong>.
              Los recibos que ya existan se saltarán y se reportarán al final.
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <Upload className="h-10 w-10 mx-auto mb-2 text-slate-400" />
              {file ? (
                <div>
                  <p className="text-sm font-medium text-slate-700">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB · Click para cambiar</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-600">Arrastra el archivo aquí o click para seleccionar</p>
                  <p className="text-xs text-slate-400 mt-1">Formatos: .xlsx, .xls, .csv</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
                <p className="text-2xl font-bold text-emerald-700">{result.created}</p>
                <p className="text-xs text-emerald-600">Creados</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
                <AlertTriangle className="h-5 w-5 mx-auto text-amber-600 mb-1" />
                <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                <p className="text-xs text-amber-600">Saltados</p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                <XCircle className="h-5 w-5 mx-auto text-red-600 mb-1" />
                <p className="text-2xl font-bold text-red-700">{result.notFound}</p>
                <p className="text-xs text-red-600">No encontrados</p>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">Total de filas procesadas: {result.total}</p>

            {/* Detalle creados */}
            {result.createdDetails?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-emerald-700">✓ Creados ({result.createdDetails.length})</p>
                <div className="max-h-32 overflow-y-auto rounded-lg border border-emerald-100 bg-emerald-50/50">
                  {result.createdDetails.map((r, i) => (
                    <div key={i} className="px-3 py-1.5 text-xs flex justify-between border-b border-emerald-100/50 last:border-0">
                      <span className="font-mono text-emerald-800">{r.shipping_mark}</span>
                      <span className="text-slate-600">Recibo {r.invoice_number} · {r.cbm} CBM · {r.fecha_salida}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detalle saltados */}
            {result.skippedDetails?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-700">⚠ Saltados - ya existen ({result.skippedDetails.length})</p>
                <div className="max-h-32 overflow-y-auto rounded-lg border border-amber-100 bg-amber-50/50">
                  {result.skippedDetails.map((r, i) => (
                    <div key={i} className="px-3 py-1.5 text-xs flex justify-between border-b border-amber-100/50 last:border-0">
                      <span className="font-mono text-amber-800">{r.shipping_mark}</span>
                      <span className="text-slate-600">Recibo {r.invoice_number} · {r.cbm} CBM</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detalle no encontrados */}
            {result.notFoundDetails?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-red-700">✕ No encontrados ({result.notFoundDetails.length})</p>
                <div className="max-h-32 overflow-y-auto rounded-lg border border-red-100 bg-red-50/50">
                  {result.notFoundDetails.map((r, i) => (
                    <div key={i} className="px-3 py-1.5 text-xs flex flex-col border-b border-red-100/50 last:border-0">
                      <span className="font-mono text-red-800">{r.shipping_mark || '(vacío)'}</span>
                      <span className="text-slate-500">{r.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {result ? (
            <>
              <Button variant="outline" onClick={downloadReport} className="gap-2">
                <Download className="h-4 w-4" /> Descargar reporte
              </Button>
              <Button onClick={() => { reset(); onOpenChange?.(false); }} className="gap-2">
                Cerrar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange?.(false)}>Cancelar</Button>
              <Button onClick={handleProcess} disabled={!file || processing} className="gap-2">
                {processing ? (
                  <>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                    {uploading ? 'Subiendo...' : 'Procesando...'}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Importar
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}