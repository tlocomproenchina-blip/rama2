import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, XCircle, Download, Eye, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_META = {
  nuevo: { label: 'Nuevo', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
  duplicado: { label: 'Duplicado', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle },
  no_encontrado: { label: 'No encontrado', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle },
};

export default function CbmImportDialog({ open, onOpenChange, onDone }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
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
    setPreview(null);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // Paso 1: dry-run para generar vista previa
  const handlePreview = async () => {
    if (!file) return;
    setProcessing(true);
    setUploading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
      const fileUrl = uploadRes?.file_url;
      if (!fileUrl) {
        toast.error('No se pudo subir el archivo');
        setProcessing(false);
        setUploading(false);
        return;
      }
      setUploading(false);

      const res = await base44.functions.invoke('importCbmIngresosFromExcel', { file_url: fileUrl, dry_run: true });
      const data = res?.data || res;
      if (data?.error) {
        toast.error(data.error);
        setProcessing(false);
        return;
      }
      setPreview({ ...data, fileUrl });
    } catch (e) {
      toast.error('Error al analizar: ' + (e?.message || ''));
    }
    setProcessing(false);
  };

  // Paso 2: confirmar y crear
  const handleConfirmImport = async () => {
    if (!preview?.fileUrl) return;
    setProcessing(true);
    try {
      const res = await base44.functions.invoke('importCbmIngresosFromExcel', { file_url: preview.fileUrl, dry_run: false });
      const data = res?.data || res;
      if (data?.error) {
        toast.error(data.error);
        setProcessing(false);
        return;
      }
      setResult(data);
      setPreview(null);
      toast.success(`${data.created || 0} recibo(s) creado(s)`);
      if (data.created > 0) onDone?.();
    } catch (e) {
      toast.error('Error al importar: ' + (e?.message || ''));
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

  const downloadNotFoundReport = () => {
    if (!result?.notFoundDetails?.length) return;
    const now = new Date();
    const lines = [
      'REPORTE DE NO ENCONTRADOS - IMPORTACIÓN CBM',
      `Fecha: ${now.toLocaleString('es-VE')}`,
      `Total no encontrados: ${result.notFoundDetails.length}`,
      '',
      'Shipping Mark\tRecibo\tCBM\tFecha Salida\tMotivo'
    ];
    result.notFoundDetails.forEach(r => {
      lines.push(`${r.shipping_mark || '(vacío)'}\t${r.invoice_number || ''}\t${r.cbm || ''}\t${r.fecha_salida || ''}\t${r.reason || ''}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `no_encontrados_cbm_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isPreviewStep = preview && !result;
  const isResultStep = result;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            {isPreviewStep ? 'Vista previa de importación' : 'Importar Recibos CBM desde Excel'}
          </DialogTitle>
        </DialogHeader>

        {/* Paso 1: Selección de archivo */}
        {!isPreviewStep && !isResultStep && (
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                El archivo debe tener                 <strong>5 columnas fijas en este orden exacto</strong> (los nombres de los encabezados no importan, solo la posición):
              </p>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-2 py-1.5 text-center font-bold text-slate-600 w-10">Col</th>
                      <th className="px-2 py-1.5 text-left font-bold text-slate-600">Campo</th>
                      <th className="px-2 py-1.5 text-left font-bold text-slate-600">Ejemplo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="bg-blue-50/40">
                      <td className="px-2 py-1.5 text-center font-bold text-blue-600">A</td>
                      <td className="px-2 py-1.5 font-medium text-slate-700">Shipping Mark</td>
                      <td className="px-2 py-1.5 font-mono text-slate-500">TLEC-ABC123</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 text-center font-bold text-slate-500">B</td>
                      <td className="px-2 py-1.5 font-medium text-slate-700">Orden / Recibo</td>
                      <td className="px-2 py-1.5 font-mono text-slate-500">ORD-001234</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 text-center font-bold text-slate-500">C</td>
                      <td className="px-2 py-1.5 font-medium text-slate-700">CBM (número)</td>
                      <td className="px-2 py-1.5 font-mono text-slate-500">2.50000</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 text-center font-bold text-slate-500">D</td>
                      <td className="px-2 py-1.5 font-medium text-slate-700">Fecha de salida</td>
                      <td className="px-2 py-1.5 font-mono text-slate-500">2026-03-16</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1.5 text-center font-bold text-slate-500">E</td>
                      <td className="px-2 py-1.5 font-medium text-slate-700">Notas (opcional)</td>
                      <td className="px-2 py-1.5 font-mono text-slate-500">Carga frágil</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ✓ Fila 1 = encabezados (se ignoran) · Los datos se leen desde la fila 2 en adelante.
              </p>
            </div>

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
        )}

        {/* Paso 2: Vista previa */}
        {isPreviewStep && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
                <p className="text-2xl font-bold text-emerald-700">{preview.summary?.nuevos || 0}</p>
                <p className="text-xs text-emerald-600">Nuevos</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
                <AlertTriangle className="h-5 w-5 mx-auto text-amber-600 mb-1" />
                <p className="text-2xl font-bold text-amber-700">{preview.summary?.duplicados || 0}</p>
                <p className="text-xs text-amber-600">Duplicados</p>
              </div>
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-center">
                <XCircle className="h-5 w-5 mx-auto text-red-600 mb-1" />
                <p className="text-2xl font-bold text-red-700">{preview.summary?.no_encontrados || 0}</p>
                <p className="text-xs text-red-600">No encontrados</p>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Total de filas: {preview.total} · Se crearán solo los {preview.summary?.nuevos || 0} recibos nuevos
            </p>

            <div className="max-h-[40vh] overflow-y-auto overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs min-w-[640px]">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-2 py-2 font-semibold text-slate-600">Shipping Mark</th>
                    <th className="text-left px-2 py-2 font-semibold text-slate-600">Recibo</th>
                    <th className="text-right px-2 py-2 font-semibold text-slate-600">CBM</th>
                    <th className="text-left px-2 py-2 font-semibold text-slate-600">Fecha</th>
                    <th className="text-left px-2 py-2 font-semibold text-slate-600">Notas</th>
                    <th className="text-left px-2 py-2 font-semibold text-slate-600">Cliente</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-600">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows?.map((r, i) => {
                    const meta = STATUS_META[r.status] || STATUS_META.no_encontrado;
                    const Icon = meta.icon;
                    return (
                      <tr key={i} className={`border-b border-slate-100 last:border-0 ${meta.bg}`}>
                        <td className="px-2 py-1.5 font-mono text-slate-700">{r.shipping_mark || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-600">{r.invoice_number || '—'}</td>
                        <td className="px-2 py-1.5 text-right text-slate-600">{r.cbm || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-600">{r.fecha_salida || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-600 truncate max-w-[160px]">{r.notas || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-600 truncate max-w-[140px]">{r.client_name || (r.status === 'no_encontrado' ? '—' : '')}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${meta.color} ${meta.bg} border ${meta.border}`}>
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </span>
                          {r.reason && <p className="text-[10px] text-slate-500 mt-0.5">{r.reason}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Paso 3: Resultado final */}
        {isResultStep && (
          <div className="space-y-4 py-2">
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

        <DialogFooter className="gap-2 flex-wrap">
          {isResultStep ? (
            <>
              <Button variant="outline" onClick={downloadReport} className="gap-2">
                <Download className="h-4 w-4" /> Descargar reporte
              </Button>
              {result.notFoundDetails?.length > 0 && (
                <Button variant="outline" onClick={downloadNotFoundReport} className="gap-2 border-red-200 text-red-700 hover:bg-red-50">
                  <XCircle className="h-4 w-4" /> Descargar no encontrados ({result.notFoundDetails.length})
                </Button>
              )}
              <Button onClick={() => { reset(); onOpenChange?.(false); }} className="gap-2">
                Cerrar
              </Button>
            </>
          ) : isPreviewStep ? (
            <>
              <Button variant="outline" onClick={() => setPreview(null)} className="gap-2" disabled={processing}>
                <ArrowLeft className="h-4 w-4" /> Atrás
              </Button>
              <Button onClick={handleConfirmImport} disabled={processing} className="gap-2">
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Confirmar importación ({preview.summary?.nuevos || 0})
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange?.(false)}>Cancelar</Button>
              <Button onClick={handlePreview} disabled={!file || processing} className="gap-2">
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploading ? 'Subiendo...' : 'Analizando...'}
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" /> Ver vista previa
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