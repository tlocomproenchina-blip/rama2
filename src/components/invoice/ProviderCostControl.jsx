import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { invoiceProfit } from '@/lib/invoiceProfit';

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

// Marca manual de "pagado al proveedor" por factura + beneficio real.
export default function ProviderCostControl({ invoice, onTogglePaid, costMap }) {
  const p = costMap ? invoiceProfit(invoice, costMap) : null;
  return (
    <div className="space-y-2">
      <label
        className="flex w-full items-center gap-2 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={!!invoice.provider_paid}
          onCheckedChange={(checked) => onTogglePaid(invoice, !!checked)}
        />
        <span className={`text-sm font-medium ${invoice.provider_paid ? 'text-emerald-700' : 'text-slate-600'}`}>
          Marcar como pagado al proveedor
        </span>
      </label>
      {p?.linked && invoice.status === 'pagada' && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-border px-3 py-2 text-xs">
          {(
            <span>Beneficio: <b className={p.profit >= 0 ? 'text-success' : 'text-destructive'}>{fmt(p.profit)}</b></span>
          )}
        </div>
      )}
    </div>
  );
}