import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Boxes, Ship } from 'lucide-react';
import { format } from 'date-fns';

const fmtDate = (d) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—');

export default function ClientCbmHistory({ ingresos, totalCbm }) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-slate-700" />
            <h3 className="text-lg font-bold text-slate-800">Historial de CBM</h3>
            <Badge variant="secondary">{ingresos?.length || 0}</Badge>
          </div>
          <Badge className="bg-blue-100 text-blue-700 text-base">Total: {Number(totalCbm || 0).toFixed(5)} CBM</Badge>
        </div>

        {(!ingresos || ingresos.length === 0) ? (
          <p className="text-center text-slate-500 py-6">Sin registros de CBM</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">CBM</th>
                  <th className="py-2 pr-3">Factura</th>
                  <th className="py-2 pr-3">Proveedor</th>
                  <th className="py-2 pr-3">Trackings</th>
                  <th className="py-2 pr-3">Salida</th>
                  <th className="py-2 pr-3">Llegada est.</th>
                </tr>
              </thead>
              <tbody>
                {ingresos.map((i) => (
                  <tr key={i.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="py-2 pr-3 text-xs text-slate-600">{fmtDate(i.fecha)}</td>
                    <td className="py-2 pr-3 font-semibold text-blue-700">{Number(i.cbm || 0).toFixed(5)}</td>
                    <td className="py-2 pr-3">{i.invoice_number || '—'}</td>
                    <td className="py-2 pr-3">{i.proveedor || '—'}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {(i.tracking_numbers || []).slice(0, 3).map((t) => (
                          <span key={t} className="inline-block text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">{t}</span>
                        ))}
                        {(i.tracking_numbers || []).length > 3 && (
                          <span className="text-[10px] text-slate-500">+{i.tracking_numbers.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {i.fecha_salida ? (
                        <span className="flex items-center gap-1 text-emerald-600"><Ship className="h-3 w-3" />{i.fecha_salida}</span>
                      ) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">{i.fecha_estimada_llegada || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}