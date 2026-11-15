import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";

// Marca manual de "pagado al proveedor" por factura.
export default function ProviderCostControl({ invoice, onTogglePaid }) {
  return (
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
  );
}