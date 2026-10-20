import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadContainersReport } from '@/lib/containersReport';

// Informe administrativo de contenedores: una fila por contenedor (N° de orden/envío)
// con shipping mark, nombre y apellido del cliente, cantidad de bultos y descripción.
export default function ContainersReportButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [generating, setGenerating] = useState(false);

  const openReport = async () => {
    setOpen(true);
    if (rows.length) return;
    setLoading(true);
    const res = await base44.functions.invoke('getContainersReport', {});
    setRows(res?.data?.rows || []);
    setLoading(false);
  };

  const download = async () => {
    if (!rows.length) {
      toast.error('No hay contenedores para exportar');
      return;
    }
    setGenerating(true);
    await downloadContainersReport(rows);
    setGenerating(false);
    toast.success('Archivo generado');
  };

  const totalBultos = rows.reduce((sum, row) => sum + Number(row.bultos || 0), 0);

  return (
    <>
      <Button variant="outline" onClick={openReport}>
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        Informe de contenedores
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-slate-700" />
              Informe de contenedores y bultos
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Contenedores</p>
                  <p className="text-sm font-bold text-slate-800">{rows.length}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Bultos registrados</p>
                  <p className="text-sm font-bold text-slate-800">{totalBultos}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Columnas del archivo</p>
                  <p className="text-[11px] text-slate-600">Shipping mark · Nombre · Apellido · Contenedor · Bultos · Descripción</p>
                </div>
              </div>

              <div className="max-h-[52vh] overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-2 py-2">Shipping mark</th>
                      <th className="px-2 py-2">Nombre</th>
                      <th className="px-2 py-2">Apellido</th>
                      <th className="px-2 py-2">Contenedor</th>
                      <th className="px-2 py-2 text-center">Bultos</th>
                      <th className="px-2 py-2">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={`${row.container}-${index}`} className="border-t border-slate-100 align-top">
                        <td className="px-2 py-2 font-mono text-[10px] text-slate-700">{row.shipping_mark || '—'}</td>
                        <td className="px-2 py-2 text-slate-700">{row.first_name || '—'}</td>
                        <td className="px-2 py-2 text-slate-700">{row.last_name || '—'}</td>
                        <td className="px-2 py-2 font-semibold text-slate-800">{row.container}</td>
                        <td className="px-2 py-2 text-center font-semibold text-slate-800">{row.bultos}</td>
                        <td className="px-2 py-2 text-slate-600">{row.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && (
                  <p className="py-10 text-center text-sm text-slate-500">No hay contenedores registrados.</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={download} disabled={!rows.length || generating}>
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Descargar Excel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}