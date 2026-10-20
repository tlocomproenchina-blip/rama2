import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileWarning, Loader2, Printer } from 'lucide-react';
import {
  enrichOverdueRows,
  generateOverdueReportPdf,
  overdueReportRows,
  overdueTotals,
} from '@/lib/overdueReport';

// Informe imprimible de las facturas vencidas que se están mostrando: shipping mark,
// contenedor, tracking, cliente y total. Vive dentro de la pestaña Vencidas.
export default function OverdueInvoicesReportButton({ invoices = [], appName = 'TLEC CARGO' }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState('');

  const openReport = async () => {
    setOpen(true);
    setLoading(true);
    const base = overdueReportRows(invoices);
    const enriched = await enrichOverdueRows(base).catch(() => base);
    setRows(enriched);
    setLoading(false);
  };

  const download = async (mode) => {
    setGenerating(mode);
    await generateOverdueReportPdf(rows, mode, appName);
    setGenerating('');
  };

  const totals = overdueTotals(rows);

  return (
    <>
      <Button
        variant="outline"
        onClick={openReport}
        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
      >
        <FileWarning className="mr-2 h-4 w-4" />
        Informe de vencidas
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-red-600" />
              Informe de facturas vencidas
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-red-600" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Facturas vencidas</p>
                  <p className="text-sm font-bold text-slate-800">{totals.count}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-red-700">Total vencido</p>
                  <p className="text-sm font-bold text-red-700">${totals.total.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Incluye</p>
                  <p className="text-[11px] text-slate-600">Shipping mark · contenedor · tracking · cliente · total</p>
                </div>
              </div>

              {rows.length === 0 ? (
                <p className="rounded-lg bg-slate-50 py-10 text-center text-sm text-slate-500">
                  No hay facturas vencidas con los filtros actuales.
                </p>
              ) : (
                <div className="max-h-[52vh] overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-2 py-2">Factura</th>
                        <th className="px-2 py-2">Cliente</th>
                        <th className="px-2 py-2">Shipping mark</th>
                        <th className="px-2 py-2">Contenedor</th>
                        <th className="px-2 py-2">Tracking</th>
                        <th className="px-2 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100 align-top">
                          <td className="px-2 py-2">
                            <p className="font-semibold text-slate-800">{row.invoice_number}</p>
                            <p className="text-[10px] text-slate-500">
                              {row.invoice_date ? new Date(row.invoice_date).toLocaleDateString('es-VE') : '—'}
                            </p>
                          </td>
                          <td className="px-2 py-2 text-slate-700">{row.client_name}</td>
                          <td className="px-2 py-2">
                            {row.shipping_mark
                              ? <Badge variant="outline" className="font-mono text-[10px]">{row.shipping_mark}</Badge>
                              : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-2 py-2 text-slate-700">
                            {row.containers.length ? row.containers.join(', ') : '—'}
                          </td>
                          <td className="px-2 py-2 font-mono text-[10px] text-slate-700">
                            {row.trackings.length ? row.trackings.join(', ') : '—'}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold text-slate-800">
                            ${row.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => download('save')} disabled={!rows.length || !!generating}>
                  {generating === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Descargar PDF
                </Button>
                <Button
                  onClick={() => download('print')}
                  disabled={!rows.length || !!generating}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {generating === 'print' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                  Imprimir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}