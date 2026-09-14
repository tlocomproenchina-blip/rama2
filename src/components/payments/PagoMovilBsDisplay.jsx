import React from 'react';
import { Euro, Copy } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Muestra los 3 datos de Pago Móvil (teléfono, banco, cédula) y el monto equivalente
 * en Bolívares (Bs) usando la tasa EUR del BCV.
 *
 * Props:
 * - config: AppConfig (debe incluir bcv_eur_rate, bcv_eur_rate_date, pago_movil_phone, etc.)
 * - amountUsd: number — monto en USD a convertir a Bs
 */
export default function PagoMovilBsDisplay({ config, amountUsd }) {
  const phone = config?.pago_movil_phone || '';
  const bank = config?.pago_movil_bank || '';
  const cedula = config?.pago_movil_cedula || '';
  const eurRate = Number(config?.bcv_eur_rate || 0);
  const rateDate = config?.bcv_eur_rate_date || null;

  const hasBs = eurRate > 0 && amountUsd > 0;
  const amountBs = hasBs ? (amountUsd * eurRate) : 0;

  const copyField = (label, value) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  };

  const formatDate = (d) => {
    if (!d) return '';
    try {
      const date = d.includes('T') ? new Date(d) : new Date(d + 'T00:00:00');
      return date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const fields = [
    { label: 'Número de teléfono', value: phone },
    { label: 'Banco', value: bank },
    { label: 'Cédula', value: cedula },
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500">{f.label}</p>
              <p className="truncate font-mono text-sm font-semibold text-slate-800">
                {f.value || 'No configurado'}
              </p>
            </div>
            {f.value && (
              <button
                type="button"
                onClick={() => copyField(f.label, f.value)}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {hasBs && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <Euro className="h-4 w-4 text-blue-600" />
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
              Monto en Bolívares (Bs)
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-700">
            Bs {amountBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Calculado: ${amountUsd.toFixed(2)} × {eurRate.toFixed(2)} Bs/€
          </p>
          {rateDate && (
            <p className="mt-1 text-xs text-slate-400">
              Tasa BCV vigente: {formatDate(rateDate)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}