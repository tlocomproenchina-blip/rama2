import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ContainerProviderCost from './provider-cross/ContainerProviderCost';
import ProviderCrossDetail from './provider-cross/ProviderCrossDetail';

// CBM de cada contenedor de la factura y el total de la factura.
// Los recibos de la factura (manual_recibos) son la fuente: cada uno guarda su
// N° de contenedor y su CBM, así que el total es la suma de lo que se muestra.

const round4 = (value) => Math.round(Number(value || 0) * 10000) / 10000;

const formatCbm = (value) => {
  const n = round4(value);
  return Number.isFinite(n) ? String(n) : '0';
};

export default function InvoiceCbmOrders({ invoice }) {
  const rows = (Array.isArray(invoice?.manual_recibos) ? invoice.manual_recibos : [])
    .map((recibo, index) => ({
      key: `${index}-${recibo?.invoice_number || ''}`,
      order_number: String(recibo?.invoice_number || '').trim(),
      cbm: Number(recibo?.cbm || 0)
    }))
    .filter((row) => row.order_number);

  const [open, setOpen] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['providerCostCross'],
    queryFn: () => base44.functions.invoke('providerCostCross', {}).then((r) => r.data.rows || []),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const linked = (data || []).filter((r) => r.client_invoices.some((i) => i.id === invoice?.id));
  const norm = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const costsFor = (code) => linked.filter((r) => norm(r.container) === norm(code));

  const invoiceTotal = Number(invoice?.total_cbm ?? invoice?.cost_breakdown?.total_cbm ?? 0);
  if (rows.length === 0 && !(invoiceTotal > 0)) return null;

  const total = rows.length > 0 ? round4(rows.reduce((sum, row) => sum + row.cbm, 0)) : round4(invoiceTotal);

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <Boxes className="h-3.5 w-3.5" /> CBM por contenedor
        </span>
        <span className="text-xs font-semibold text-slate-800 shrink-0">{formatCbm(total)} CBM</span>
      </div>

      {rows.length > 0 && (
        <div className="mt-2 space-y-1">
          {rows.map((row) => (
            <div key={row.key} className="space-y-1">
              <div className="flex justify-between gap-3">
                <span className="min-w-0 break-words text-slate-600">Contenedor {row.order_number}</span>
                <span className="shrink-0 font-medium text-slate-800">{formatCbm(row.cbm)} CBM</span>
              </div>
              <ContainerProviderCost rows={costsFor(row.order_number)} loading={isLoading} onOpen={setOpen} />
            </div>
          ))}
        </div>
      )}
      <ProviderCrossDetail row={open} onClose={() => setOpen(null)} />

      <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-1.5 font-semibold text-slate-800">
        <span>Total</span>
        <span className="flex shrink-0 gap-6">
          <span>Costo pendiente ${(() => {
            const seen = new Set();
            return rows.flatMap((r) => costsFor(r.order_number)).reduce((s, c) => {
              const k = c.id || `${c.container}-${c.total}`;
              if (seen.has(k)) return s; seen.add(k);
              if (c.status === 'pagada' || c.balance <= 0) return s;
              return s + Number(c.total || 0);
            }, 0).toFixed(2);
          })()}</span>
          <span>{formatCbm(total)} CBM</span>
        </span>
      </div>
    </div>
  );
}