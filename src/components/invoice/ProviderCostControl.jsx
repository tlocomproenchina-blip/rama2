import React, { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from 'lucide-react';

/**
 * Control manual de costo al proveedor por factura.
 * - Permite ingresar cuánto se pagó al proveedor (provider_cost_total).
 * - Muestra la ganancia resultante (total - costo proveedor).
 * - Permite marcar la factura como pagada al proveedor.
 * No contiene lógica de persistencia: delega en onSaveCost y onTogglePaid.
 */
export default function ProviderCostControl({ invoice, onSaveCost, onTogglePaid }) {
  const [value, setValue] = useState(
    invoice.provider_cost_total != null ? String(invoice.provider_cost_total) : ''
  );
  const [saving, setSaving] = useState(false);

  const cost = parseFloat(value);
  const validCost = Number.isFinite(cost);
  const profit = validCost ? (Number(invoice.total || 0) - cost) : null;
  const dirty = String(invoice.provider_cost_total ?? '') !== value.trim();

  const handleSave = async () => {
    if (!validCost) return;
    setSaving(true);
    try {
      await onSaveCost(invoice, cost);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs font-medium text-slate-600">Pagado al proveedor ($)</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0.00"
            className="mt-1 bg-white"
          />
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!validCost || !dirty || saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          <span className="ml-1">Guardar</span>
        </Button>
      </div>

      {profit != null && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Ganancia de esta factura</span>
          <span className={`font-semibold ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            ${profit.toFixed(2)}
          </span>
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-slate-200">
        <Checkbox
          checked={!!invoice.provider_paid}
          onCheckedChange={(checked) => onTogglePaid(invoice, !!checked)}
        />
        <span className={`text-sm font-medium ${invoice.provider_paid ? 'text-emerald-700' : 'text-slate-600'}`}>
          Marcar como pagado al proveedor
        </span>
      </label>
    </div>
  );
}