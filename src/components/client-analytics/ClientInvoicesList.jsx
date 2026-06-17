import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, ChevronDown, ChevronRight, Receipt } from 'lucide-react';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const STATUS_STYLES = {
  pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
  revision: 'bg-blue-100 text-blue-700 border-blue-200',
  pagada: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  vencida: 'bg-rose-100 text-rose-700 border-rose-200',
  cancelada: 'bg-slate-100 text-slate-500 border-slate-200',
};

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function ClientInvoicesList({ invoices }) {
  const [expanded, setExpanded] = useState(null);

  const list = Array.isArray(invoices) ? invoices : [];

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800">
          <FileText className="h-5 w-5 text-blue-600" /> Facturas del cliente
          <span className="text-sm font-normal text-slate-400">({list.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.length === 0 ? (
          <p className="py-8 text-center text-slate-500">Este cliente no tiene facturas.</p>
        ) : (
          list.map((invoice) => {
            const isOpen = expanded === invoice.id;
            const items = Array.isArray(invoice.items) ? invoice.items : [];
            return (
              <div key={invoice.id} className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : invoice.id)}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{invoice.invoice_number || '—'}</p>
                      <p className="text-xs text-slate-500">{formatDate(invoice.invoice_date || invoice.created_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className={STATUS_STYLES[invoice.status] || STATUS_STYLES.pendiente}>
                      {invoice.status || 'pendiente'}
                    </Badge>
                    <span className="font-bold text-slate-800">${num(invoice.total).toFixed(2)}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
                    {(num(invoice.total_cbm) > 0 || num(invoice.billed_cbm) > 0) && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {num(invoice.total_cbm) > 0 && (
                          <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-slate-600">CBM total: {num(invoice.total_cbm).toFixed(4)}</span>
                        )}
                        {num(invoice.billed_cbm) > 0 && (
                          <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-slate-600">CBM facturado: {num(invoice.billed_cbm).toFixed(4)}</span>
                        )}
                      </div>
                    )}

                    <p className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <Receipt className="h-3.5 w-3.5" /> Recibos / conceptos ({items.length})
                    </p>

                    {items.length === 0 ? (
                      <p className="text-sm text-slate-500">Sin conceptos registrados.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full min-w-max text-sm">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="text-left p-2 font-medium">Descripción</th>
                              <th className="text-right p-2 font-medium">Cant.</th>
                              <th className="text-right p-2 font-medium">P. unit.</th>
                              <th className="text-right p-2 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, i) => (
                              <tr key={i} className="border-t border-slate-100">
                                <td className="p-2 text-slate-700">{item.description || '—'}</td>
                                <td className="p-2 text-right text-slate-600">{num(item.quantity)}</td>
                                <td className="p-2 text-right text-slate-600">${num(item.unit_price).toFixed(2)}</td>
                                <td className="p-2 text-right font-semibold text-slate-800">${num(item.total).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {invoice.notes && (
                      <p className="text-xs text-slate-500 break-words">{invoice.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}