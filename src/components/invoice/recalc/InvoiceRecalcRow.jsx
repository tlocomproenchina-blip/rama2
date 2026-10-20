import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const money = (v) => `$${(Number(v) || 0).toFixed(2)}`;

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const SOURCE_LABEL = {
  manual: 'indicado ahora',
  factura: 'guardado en la factura',
  recibo: 'del recibo',
  predeterminado: 'predeterminado',
};

// Una factura dentro del recálculo: envío y total antes → después, y el detalle
// de cada recibo con su tipo de carga para ajustar la tarifa.
export default function InvoiceRecalcRow({ invoice, excluded, onToggleExclude, onTypeChange }) {
  const [open, setOpen] = useState(false);

  const changed = !!invoice.changed;
  const blocked = !!invoice.blocked;
  const selectable = changed && !blocked;
  const delta = (Number(invoice.after?.total) || 0) - (Number(invoice.before?.total) || 0);
  const shippingChanged = Math.abs((Number(invoice.after?.shipping) || 0) - (Number(invoice.before?.shipping) || 0)) >= 0.01;
  const lines = invoice.lines || [];

  return (
    <div className={`rounded-xl border ${selectable ? 'border-amber-200 bg-amber-50/50' : 'border-border bg-card'}`}>
      <div className="flex flex-wrap items-center gap-3 p-3">
        {selectable ? (
          <Checkbox
            checked={!excluded}
            onCheckedChange={() => onToggleExclude(invoice.invoice_id)}
            aria-label={`Incluir ${invoice.invoice_number}`}
          />
        ) : (
          <span className="w-4" />
        )}

        <div className="min-w-[10rem] flex-1">
          <p className="font-mono text-xs font-semibold text-foreground">{invoice.invoice_number}</p>
          <p className="truncate text-[11px] text-muted-foreground">{invoice.client_email}</p>
        </div>

        <Badge variant="outline" className="text-[10px] uppercase">{invoice.status}</Badge>
        {invoice.paid && (
          <Badge variant="outline" className="border-blue-200 text-[10px] text-blue-700">Pagada</Badge>
        )}

        <div className="text-[11px] text-muted-foreground">
          Envío <span className="font-semibold text-foreground">{money(invoice.before?.shipping)}</span>
          {' → '}
          <span className={`font-semibold ${shippingChanged ? 'text-amber-700' : 'text-foreground'}`}>
            {money(invoice.after?.shipping)}
          </span>
        </div>

        <div className="text-[11px] text-muted-foreground">
          Total <span className="font-semibold text-foreground">{money(invoice.before?.total)}</span>
          {' → '}
          <span className={`font-semibold ${Math.abs(delta) >= 0.01 ? (delta > 0 ? 'text-amber-700' : 'text-emerald-700') : 'text-foreground'}`}>
            {money(invoice.after?.total)}
          </span>
          {Math.abs(delta) >= 0.01 && (
            <span className={delta > 0 ? 'text-amber-700' : 'text-emerald-700'}>
              {' '}({delta > 0 ? '+' : ''}{delta.toFixed(2)})
            </span>
          )}
        </div>

        {blocked ? (
          <Badge variant="outline" className="border-slate-300 text-[10px] text-slate-600">Sin ajuste</Badge>
        ) : !changed ? (
          <Badge variant="outline" className="border-emerald-200 text-[10px] text-emerald-700">Sin cambios</Badge>
        ) : null}

        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronUp className="mr-1 h-3.5 w-3.5" /> : <ChevronDown className="mr-1 h-3.5 w-3.5" />}
          {lines.length} recibo(s)
        </Button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {blocked && (
            <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {invoice.blocked}
            </p>
          )}

          {(invoice.warnings || []).map((w, i) => (
            <p key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
            </p>
          ))}

          {lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[11px]">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">N° recibo</th>
                    <th className="py-1 pr-3 font-medium">CBM</th>
                    <th className="py-1 pr-3 font-medium">Fecha del recibo</th>
                    <th className="py-1 pr-3 font-medium">Tipo de carga</th>
                    <th className="py-1 pr-3 font-medium">Tarifa por CBM</th>
                    <th className="py-1 font-medium">Monto del envío</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.key} className="border-t border-border/60">
                      <td className="py-2 pr-3 font-mono text-[11px]">{line.number || '—'}</td>
                      <td className="py-2 pr-3">{(Number(line.cbm) || 0).toFixed(5)}</td>
                      <td className="py-2 pr-3">{formatDate(line.fecha)}</td>
                      <td className="py-2 pr-3">
                        <Select
                          value={line.type}
                          onValueChange={(value) => onTypeChange(invoice.invoice_id, line.key, value)}
                        >
                          <SelectTrigger className="h-8 w-[11rem] text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General (regular)</SelectItem>
                            <SelectItem value="alto_riesgo">Alto riesgo / sensible</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-[10px] text-muted-foreground">
                          {SOURCE_LABEL[line.type_from] || line.type_from}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        {money(line.unit_before)} → <span className="font-semibold">{money(line.rate)}</span>
                      </td>
                      <td className="py-2">
                        {money(line.total_before)} → <span className="font-semibold">{money(line.total_after)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}