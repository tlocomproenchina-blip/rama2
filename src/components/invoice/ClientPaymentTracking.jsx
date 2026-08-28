import React, { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Wallet } from 'lucide-react';

// Identifica los ítems que son envíos (tienen details.invoice_number o descripción "Envío X")
const isEnvioItem = (item) => {
  if (item?.details?.invoice_number) return true;
  return /^Envío\s+\S+/i.test(String(item?.description || ''));
};

/**
 * Seguimiento de pagos del cliente por envío.
 * Muestra cada envío con su monto, lo que el cliente ha pagado y el saldo restante.
 * El admin selecciona un envío, ingresa el monto que pagó el cliente y lo guarda:
 * el monto se acumula contra ese envío y se tacha cuando queda saldado.
 * Persiste en items[].details.client_paid_amount.
 */
export default function ClientPaymentTracking({ invoice, onSavePayment }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);

  const envioItems = (Array.isArray(invoice.items) ? invoice.items : [])
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => isEnvioItem(item));

  const totalFacturado = envioItems.reduce((s, { item }) => s + Number(item.total || 0), 0);
  const totalPagado = envioItems.reduce((s, { item }) => s + Number(item.details?.client_paid_amount || 0), 0);
  const saldoPendiente = Math.max(0, totalFacturado - totalPagado);

  const entered = parseFloat(value);
  const validEntered = Number.isFinite(entered) && entered > 0;

  const handleSave = async () => {
    if (!validEntered) return;
    setSaving(true);
    try {
      await onSavePayment(invoice, entered, selectedItemIndex);
      setValue('');
      setSelectedItemIndex(null);
    } finally {
      setSaving(false);
    }
  };

  if (envioItems.length === 0) return null;

  return (
    <div
      className="w-full rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-blue-600" />
        <p className="text-sm font-semibold text-blue-800">Pagos del cliente por envío</p>
      </div>

      <div className="space-y-1.5">
        {envioItems.map(({ item, idx }) => {
          const owed = Number(item.total || 0);
          const paid = Number(item.details?.client_paid_amount || 0);
          const remaining = Math.max(0, owed - paid);
          const fullyPaid = paid > 0 && remaining <= 0;
          const partial = paid > 0 && remaining > 0;
          return (
            <label
              key={idx}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${fullyPaid ? 'bg-emerald-50' : 'bg-white border border-slate-200'} ${fullyPaid ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'}`}
            >
              <Checkbox
                checked={fullyPaid || selectedItemIndex === idx}
                disabled={fullyPaid}
                onCheckedChange={(c) => setSelectedItemIndex(c ? idx : null)}
              />
              <span className={`flex-1 truncate text-slate-700 ${fullyPaid ? 'line-through opacity-60' : ''}`}>{item.description}</span>
              <div className="text-right whitespace-nowrap">
                <div className={`text-xs ${fullyPaid ? 'text-emerald-700 font-semibold line-through' : 'text-slate-700 font-medium'}`}>
                  ${owed.toFixed(2)}
                </div>
                {partial && (
                  <div className="text-[10px] text-amber-600">Pagado ${paid.toFixed(2)} · Falta ${remaining.toFixed(2)}</div>
                )}
                {fullyPaid && (
                  <div className="text-[10px] text-emerald-600 font-medium">✓ Saldado</div>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">Pago del cliente ($)</label>
            <span className="text-xs text-slate-500">Saldo: ${saldoPendiente.toFixed(2)}</span>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Monto que pagó el cliente"
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

      <div className="flex items-center justify-between text-sm border-t border-blue-200 pt-2">
        <span className="text-slate-500">Total pagado por el cliente</span>
        <span className="font-semibold text-blue-700">${totalPagado.toFixed(2)} / ${totalFacturado.toFixed(2)}</span>
      </div>
      <p className="text-xs text-slate-500">Selecciona el envío que el cliente está pagando, ingresa el monto y guarda. El envío se tacha al quedar saldado.</p>
    </div>
  );
}