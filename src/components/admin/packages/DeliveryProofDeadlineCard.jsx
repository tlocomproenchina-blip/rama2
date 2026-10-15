import React from 'react';
import { CalendarClock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getDeliveryProofState, formatDeliveryProofDeadline } from '@/lib/deliveryProofDeadline';

// Plazo del comprobante de entrega visto por el administrador: cuándo vence (10
// días desde la pre-alerta) y la excepción que reabre la carga para el cliente.
export default function DeliveryProofDeadlineCard({ pkg, enabled, onChange }) {
  const state = getDeliveryProofState({ ...pkg, delivery_proof_exception: enabled });
  if (!state.hasDeadline) return null;

  const activa = state.exception;
  const vencido = state.pastDeadline;

  return (
    <div
      className={`space-y-3 rounded-lg border p-3 ${
        vencido && !activa ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-2">
        {vencido && !activa
          ? <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          : <CalendarClock className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">Comprobante de entrega (plazo de 10 días)</p>
          <p className="text-xs text-slate-600">
            {vencido
              ? `Plazo vencido el ${formatDeliveryProofDeadline(state.deadline)}.`
              : `Vence el ${formatDeliveryProofDeadline(state.deadline)}${state.daysLeft > 0 ? ` (${state.daysLeft} día(s) restante(s))` : ''}.`}
            {' '}
            {pkg?.seller_delivery_date ? 'El cliente ya cargó la fecha de entrega.' : 'El cliente todavía no ha cargado la fecha de entrega.'}
          </p>
          {activa && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Excepción habilitada
              {pkg?.delivery_proof_exception_by ? ` por ${pkg.delivery_proof_exception_by}` : ''}
              {pkg?.delivery_proof_exception_date ? ` el ${new Date(pkg.delivery_proof_exception_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
              : el cliente puede volver a cargar la fecha y la foto.
            </p>
          )}
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 border-t border-slate-200 pt-3">
        <div className="min-w-0">
          <Label className="text-sm">Habilitar excepción</Label>
          <p className="text-xs text-slate-500">
            Reabre la carga de la fecha de entrega y de su foto para este paquete, aunque el plazo esté vencido.
          </p>
        </div>
        <Switch checked={activa} onCheckedChange={(v) => onChange(!!v)} className="mt-1 shrink-0" />
      </div>
    </div>
  );
}