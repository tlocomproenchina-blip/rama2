import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, Package, Search, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function WarehousePaidTable({ search, dateFrom, dateTo }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await base44.functions.invoke('getPaidInvoicesInWarehouse', {});
        if (!cancelled) {
          setRows(res?.data?.rows || res?.rows || []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Error al cargar el reporte');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredRows = useMemo(() => {
    const q = (search || '').toLowerCase();
    const fromMs = dateFrom ? new Date(dateFrom + 'T00:00:00').getTime() : null;
    const toMs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;
    return rows.filter((r) => {
      const matchesSearch = !q || (
        (r.invoice_number || '').toLowerCase().includes(q) ||
        (r.consolidation_tracking || '').toLowerCase().includes(q) ||
        (r.client_email || '').toLowerCase().includes(q) ||
        (r.client_name || '').toLowerCase().includes(q) ||
        (r.shipping_mark || '').toLowerCase().includes(q) ||
        (r.tracking_numbers || []).some((t) => (t || '').toLowerCase().includes(q))
      );
      const payMs = r.payment_date ? new Date(r.payment_date).getTime() : null;
      const matchesDate = !payMs || (
        (fromMs === null || payMs >= fromMs) &&
        (toMs === null || payMs <= toMs)
      );
      return matchesSearch && matchesDate;
    });
  }, [rows, search, dateFrom, dateTo]);

  const handleExportCSV = () => {
    if (filteredRows.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }
    const headers = [
      'Cliente', 'Email', 'Shipping Mark', 'Cedula', 'WhatsApp',
      'Direccion', 'Ciudad', 'Estado',
      'Fecha Ultimo Reconocimiento', 'Nº Orden',
      'Fecha de Pago', 'Numero de Envio', 'Numero de Factura',
      'Trackings en Almacen', 'Paquetes en Almacen', 'Total Factura'
    ];
    const lines = [headers.join(',')];
    for (const r of filteredRows) {
      const payDate = r.payment_date ? new Date(r.payment_date).toLocaleDateString('es-VE') : '';
      const scanDate = r.last_scan_date ? new Date(r.last_scan_date).toLocaleDateString('es-VE') : '';
      const recibos = (r.cbm_order_numbers || []).join('; ');
      const trackings = (r.tracking_numbers || []).join('; ');
      const cells = [
        r.client_name || '',
        r.client_email || '',
        r.shipping_mark || '',
        r.client_cedula || '',
        r.client_whatsapp || '',
        r.client_address || '',
        r.client_city || '',
        r.client_state || '',
        scanDate,
        recibos,
        payDate,
        r.consolidation_tracking || '',
        r.invoice_number || '',
        trackings,
        r.package_count || 0,
        Number(r.total || 0).toFixed(2)
      ].map((c) => {
        const s = String(c ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      });
      lines.push(cells.join(','));
    }
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `facturas-pagadas-almacen-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Reporte exportado (${filteredRows.length} factura(s))`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-red-400 mb-3" />
          <p className="text-red-600 font-medium">Error al cargar el reporte</p>
          <p className="text-slate-500 text-sm mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary + Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{filteredRows.length}</span> factura(s) pagada(s) con carga en almacén
            {filteredRows.length !== rows.length && (
              <span className="text-slate-400"> (de {rows.length} totales)</span>
            )}
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" disabled={filteredRows.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Table */}
      {filteredRows.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-slate-300 mb-4" />
            <p className="text-slate-500">No hay facturas pagadas con carga en almacén</p>
            <p className="text-slate-400 text-sm mt-1">
              Las facturas pagadas cuyos paquetes ya fueron despachados no aparecen aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Cliente</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Fecha último reconocimiento</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">N° Orden</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Fecha Pago</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">N° Envío</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">N° Factura</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">Trackings en Almacén</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-center whitespace-nowrap">Paquetes</th>
                  <th className="px-4 py-3 font-semibold text-slate-600 text-right whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, idx) => (
                  <tr
                    key={r.invoice_id || idx}
                    className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {r.client_name || <span className="text-slate-400 italic">Sin nombre</span>}
                      </div>
                      <div className="text-xs text-slate-500">{r.client_email}</div>
                      {r.shipping_mark && (
                        <div className="text-xs text-blue-600 font-mono mt-0.5">{r.shipping_mark}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {r.last_scan_date
                        ? new Date(r.last_scan_date).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {r.cbm_order_numbers && r.cbm_order_numbers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.cbm_order_numbers.map((num, i) => (
                            <a
                              key={i}
                              href="/AdminCbmIngresos"
                              className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs font-mono hover:bg-blue-100 transition-colors"
                              title={`N° Orden: ${num}`}
                            >
                              {num}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {r.payment_date
                        ? new Date(r.payment_date).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs whitespace-nowrap">
                      {r.consolidation_tracking || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs whitespace-nowrap">
                      {r.invoice_number || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.tracking_numbers && r.tracking_numbers.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {r.tracking_numbers.slice(0, 3).map((t, i) => (
                            <span key={i} className="inline-block bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs font-mono">
                              {t}
                            </span>
                          ))}
                          {r.tracking_numbers.length > 3 && (
                            <span
                              className="inline-block text-xs text-blue-600 cursor-help"
                              title={r.tracking_numbers.join(', ')}
                            >
                              +{r.tracking_numbers.length - 3} más
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs">
                        {r.package_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                      ${Number(r.total || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}