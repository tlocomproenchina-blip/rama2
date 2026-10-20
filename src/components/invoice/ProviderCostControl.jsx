import React, { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Trash2, Pencil, X } from 'lucide-react';
import { billableTotal } from '@/lib/storageLines';

/**
 * Control manual de costo al proveedor por factura (acumulación por abonos).
 * - El admin ingresa una descripción + monto de abono que se SUMA al total pagado.
 * - Muestra el acumulado actual, el historial de abonos y la ganancia resultante.
 * - El checkbox "pagado al proveedor" es manual: se marca al liquidar todo.
 * - Los abonos del historial se pueden editar o eliminar.
 */
export default function ProviderCostControl({ invoice, onSaveCost, onTogglePaid, onDeleteAbono, onEditAbono }) {
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  // El acumulado es la SUMA real de los abonos del historial, NO provider_cost_total
  // (ese campo guarda el costo del proveedor, no lo pagado).
  const history = Array.isArray(invoice.provider_payment_history) ? invoice.provider_payment_history : [];
  const accumulated = history.reduce((sum, h) => sum + Number(h.amount || 0), 0);
  const entered = parseFloat(value);
  const validEntered = Number.isFinite(entered) && entered > 0;
  // La ganancia = total facturado - acumulado real pagado al proveedor (abonos)
  const profit = billableTotal(invoice) - accumulated;

  const resetForm = () => {
    setDescription('');
    setValue('');
    setEditingIndex(null);
  };

  const handleSave = async () => {
    if (!validEntered) return;
    setSaving(true);
    try {
      if (editingIndex !== null && onEditAbono) {
        await onEditAbono(invoice, editingIndex, entered, description.trim(), null);
      } else {
        await onSaveCost(invoice, entered, description.trim());
      }
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (idx) => {
    const abono = history[idx];
    if (!abono) return;
    setEditingIndex(idx);
    setDescription(abono.description || '');
    setValue(String(abono.amount || ''));
  };

  return (
    <div
      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-600">Pagado al proveedor ($)</label>
        <span className="text-xs text-slate-500">Acumulado: ${accumulated.toFixed(2)}</span>
      </div>

      <div className="space-y-2">
        {editingIndex !== null && (
          <div className="flex items-center justify-between rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700">
            <span>Editando abono #{editingIndex + 1}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); resetForm(); }}
              className="text-blue-600 hover:text-blue-800"
              title="Cancelar edición"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción del abono (ej: Transferencia 12/08)"
          className="bg-white"
        />
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[120px]">
            <Input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Monto del abono"
              className="bg-white"
            />
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!validEntered || saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span className="ml-1">{editingIndex !== null ? 'Actualizar' : 'Guardar'}</span>
          </Button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-white divide-y divide-slate-100 max-h-40 overflow-y-auto">
          {history.map((h, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
              <div className="min-w-0 flex-1">
                <span className="text-slate-700 truncate block">{h.description || 'Sin descripción'}</span>
                <span className="text-slate-400">
                  {h.date ? new Date(h.date).toLocaleDateString() : ''} · ${Number(h.amount || 0).toFixed(2)}
                </span>
              </div>
              {onEditAbono && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleStartEdit(idx); }}
                  className="text-slate-400 hover:text-blue-600 shrink-0"
                  title="Editar abono"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDeleteAbono && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDeleteAbono(invoice, idx); }}
                  className="text-slate-400 hover:text-red-600 shrink-0"
                  title="Eliminar abono"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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
      <p className="text-xs text-slate-500">Cada monto se suma al total pagado. Marca el checkbox cuando termines de liquidar.</p>
    </div>
  );
}