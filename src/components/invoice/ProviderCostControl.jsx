import React, { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from 'lucide-react';

/**
 * Control manual de costos por factura.
 * - "Pagado al proveedor": abonos acumulativos que se suman al total pagado al proveedor.
 * - "Envío pagado": abonos acumulativos del envío pagado por el cliente (informativo,
 *   no afecta la ganancia). Muestra el saldo pendiente si se conoce el shipping_total.
 * - Checkbox "pagado al proveedor" manual: se marca al liquidar todo.
 * No contiene lógica de persistencia: delega en onSaveCost, onSaveShippingPaid y onTogglePaid.
 */
export default function ProviderCostControl({ invoice, onSaveCost, onSaveShippingPaid, onTogglePaid }) {
  const [providerValue, setProviderValue] = useState('');
  const [shippingValue, setShippingValue] = useState('');
  const [savingProvider, setSavingProvider] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);

  const accumulatedProvider = Number(invoice.provider_cost_total || 0);
  const accumulatedShipping = Number(invoice.shipping_paid || 0);
  const shippingTotal = Number(invoice.cost_breakdown?.shipping_total || 0);
  const shippingBalance = shippingTotal > 0 ? Math.max(0, shippingTotal - accumulatedShipping) : null;

  const providerEntered = parseFloat(providerValue);
  const validProvider = Number.isFinite(providerEntered) && providerEntered > 0;
  const profit = Number(invoice.total || 0) - accumulatedProvider;

  const shippingEntered = parseFloat(shippingValue);
  const validShipping = Number.isFinite(shippingEntered) && shippingEntered > 0;

  const handleSaveProvider = async () => {
    if (!validProvider) return;
    setSavingProvider(true);
    try {
      await onSaveCost(invoice, providerEntered);
      setProviderValue('');
    } finally {
      setSavingProvider(false);
    }
  };

  const handleSaveShipping = async () => {
    if (!validShipping) return;
    setSavingShipping(true);
    try {
      await onSaveShippingPaid(invoice, shippingEntered);
      setShippingValue('');
    } finally {
      setSavingShipping(false);
    }
  };

  return (
    <div
      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Pagado al proveedor */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-600">Pagado al proveedor ($)</label>
            <span className="text-xs text-slate-500">Acumulado: ${accumulatedProvider.toFixed(2)}</span>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={providerValue}
            onChange={(e) => setProviderValue(e.target.value)}
            placeholder="Monto del abono"
            className="mt-1 bg-white"
          />
        </div>
        <Button
          size="sm"
          onClick={handleSaveProvider}
          disabled={!validProvider || savingProvider}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {savingProvider ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
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
      <p className="text-xs text-slate-500">Cada monto se suma al total pagado. Marca el checkbox cuando termines de liquidar.</p>

      {/* Envío pagado por el cliente (informativo) */}
      <div className="pt-2 border-t border-slate-200 space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Envío pagado ($)</label>
              <span className="text-xs text-slate-500">Acumulado: ${accumulatedShipping.toFixed(2)}</span>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={shippingValue}
              onChange={(e) => setShippingValue(e.target.value)}
              placeholder="Abono de envío del cliente"
              className="mt-1 bg-white"
            />
          </div>
          <Button
            size="sm"
            onClick={handleSaveShipping}
            disabled={!validShipping || savingShipping}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {savingShipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            <span className="ml-1">Guardar</span>
          </Button>
        </div>
        {shippingBalance != null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Saldo de envío pendiente</span>
            <span className={`font-semibold ${shippingBalance > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
              ${shippingBalance.toFixed(2)}
            </span>
          </div>
        )}
        <p className="text-xs text-slate-500">Informativo: registra cuánto del envío ha pagado el cliente.</p>
      </div>
    </div>
  );
}