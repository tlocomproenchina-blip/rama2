import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { money } from '@/lib/fiscalCalc';
import FiscalField from '@/components/fiscal/FiscalField';
import FiscalFileField from '@/components/fiscal/FiscalFileField';
import FiscalVatMethodCard from '@/components/fiscal/FiscalVatMethodCard';

export default function FiscalVatPaymentStep({ form, setForm, methods, vatAmount, errors = {}, verified, rejectionNote }) {
  const vat = form.vat;
  const setVat = (patch) => setForm((f) => ({ ...f, vat: { ...f.vat, ...patch } }));

  useEffect(() => {
    if (vat.method_id && vat.amount_paid === '' && vatAmount > 0) setVat({ amount_paid: vatAmount.toFixed(2) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vat.method_id, vatAmount]);

  if (verified) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm font-medium">El pago del IVA ya fue verificado por Finanzas. No necesitas cargar otro comprobante.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {rejectionNote ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Tu comprobante fue rechazado</p>
            <p>Motivo: {rejectionNote}</p>
            <p className="mt-1">Carga un nuevo comprobante. No necesitas repetir el formulario fiscal.</p>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-primary/40 bg-accent/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">IVA que debes pagar</p>
        <p className="text-3xl font-extrabold tabular-nums text-foreground">{money(vatAmount)}</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Métodos de pago disponibles para el IVA</h3>
        {methods.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Finanzas aún no habilitó métodos de pago del IVA. Guarda tu borrador y vuelve más tarde.
          </p>
        ) : (
          <div className="grid gap-3">
            {methods.map((m) => (
              <div
                key={m.id}
                role="radio"
                aria-checked={vat.method_id === m.id}
                tabIndex={0}
                onClick={() => setVat({ method_id: m.id })}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setVat({ method_id: m.id })}
                className={`cursor-pointer rounded-xl border-2 p-4 transition ${vat.method_id === m.id ? 'border-primary bg-accent/50' : 'border-border bg-card hover:border-primary/50'}`}
              >
                <FiscalVatMethodCard method={m} />
              </div>
            ))}
          </div>
        )}
        {errors.method_id ? <p className="text-xs font-medium text-destructive">{errors.method_id}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <FiscalField label="Referencia de la operación *" error={errors.reference}>
          <Input value={vat.reference} onChange={(e) => setVat({ reference: e.target.value })} maxLength={60} />
        </FiscalField>
        <FiscalField label="Fecha del pago *" error={errors.payment_date}>
          <Input type="date" value={vat.payment_date} onChange={(e) => setVat({ payment_date: e.target.value })} />
        </FiscalField>
        <FiscalField label="Monto pagado (Bs.) *" error={errors.amount_paid}>
          <Input type="number" inputMode="decimal" min="0" step="0.01" value={vat.amount_paid} onChange={(e) => setVat({ amount_paid: e.target.value.replace(/-/g, '') })} />
        </FiscalField>
      </div>

      <FiscalFileField
        label="Comprobante de pago del IVA *"
        hint="Este comprobante es independiente del pago de tu factura original. Imagen o PDF, máximo 8 MB."
        value={vat.proof_uri}
        type={vat.proof_type}
        error={errors.proof}
        onChange={({ uri, type }) => setVat({ proof_uri: uri, proof_type: type })}
      />
    </div>
  );
}