import React, { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from 'lucide-react';

// Identifica los ítems que son envíos (tienen details.invoice_number o descripción "Envío X")
const isEnvioItem = (item) => {
  if (item?.details?.invoice_number) return true;
  return /^Envío\s+\S+/i.test(String(item?.description || ''));
};

/**
 * Control manual de costo al proveedor por factura (acumulación por abonos).
 * - Lista los envíos de la factura con checkboxes para seleccionar cuál se paga.
 * - El admin ingresa un monto de abono que se SUMA al total ya pagado.
 * - Al guardar, el envío seleccionado se marca como "pagado al proveedor" individual.
 * - El checkbox global "pagado al proveedor" es manual: se marca al liquidar todo.
 */
export default function ProviderCostControl({ invoice, onSaveCost, onTogglePaid }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);

  const accumulated = Number(invoice.provider_cost_total || 0);
  const entered = parseFloat(value);
  const validEntered = Number.isFinite(entered) && entered > 0;
  const profit = Number(invoice.total || 0) - accumulated;

  const envioItems = (Array.isArray(invoice.items) ? invoice.items : [])
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => isEnvioItem(item));

  const handleSave = async () => {
    if (!validEntered) return;
    setSaving(true);
    try {
      await onSaveCost(invoice, entered, selectedItemIndex);
      setValue('');
      setSelectedItemIndex(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      {envioItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-slate-600">Envíos de esta factura</p>
          {envioItems.map(({ item, idx }) => {
            const paid = !!item.details?.provider_paid;
            const paidAmount = Number(item.details?.provider_paid_amount || 0);
            return (
              <label
                key={idx}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${paid ? 'bg-emerald-50' : 'bg-white border border-slate-200'} ${paid ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'}`}
              >
                <Checkbox
                  checked={paid || selectedItemIndex === idx}
                  disabled={paid}
                  onCheckedChange={(c) => setSelectedItemIndex(c ? idx : null)}
                />
                <span className={`flex-1 truncate text-slate-700 ${paid ? 'line-through opacity-60' : ''}`}>{item.description}</span>
                {paid ? (
                  <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap line-through">${paidAmount.toFixed(2)}</span>
                ) : (
                  <span className="text-xs text-slate-500 whitespace-nowrap">${Number(item.total || 0).toFixed(2)}</span>
                )}
              </label>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">Pagado al proveedor ($)</label>
            <span className="text-xs text-slate-500">Acumulado: ${accumulated.toFixed(2)}</span>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Monto del abono"
            className="mt-1 bg-white"
          />
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!validEntered || saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          <span className="ml-1">Guardar</span>
        </Button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Ganancia de esta factura</span>
        <span className={`font-semibold ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
          ${profit.toFixed(2)}
        </span>
      </div>

      <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-slate-200">
        <Checkbox
          checked={!!invoice.provider_paid}
          onCheckedChange={(checked) => onTogglePaid(invoice, !!checked)}
        />
        <span className={`text-sm font-medium ${invoice.provider_paid ? 'text-emerald-700' : 'text-slate-600'}`}>
          Marcar como pagado al proveedor
        </span>
      </label>
      <p className="text-xs text-slate-500">Selecciona el envío que pagas, ingresa el monto y guarda. Cada monto se suma al total.</p>
    </div>
  );
}