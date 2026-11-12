import React from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { paymentTypeLabel } from '@/lib/fiscalStatus';

const Line = ({ label, value }) =>
  value ? (
    <p className="text-sm text-foreground">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </p>
  ) : null;

// Datos de un método de pago del IVA tal como los configuró el administrador.
export default function FiscalVatMethodCard({ method }) {
  const copy = () => {
    navigator.clipboard.writeText(method.account_identifier || '');
    toast.success('Copiado al portapapeles');
  };
  return (
    <div className="space-y-1">
      <p className="text-sm font-bold text-foreground">{method.name} <span className="font-normal text-muted-foreground">- {paymentTypeLabel(method.payment_type)}</span></p>
      <Line label="Banco o plataforma" value={method.bank_platform} />
      <Line label="Titular o beneficiario" value={method.holder} />
      <Line label="Identificación del titular" value={method.holder_id} />
      {method.account_identifier ? (
        <div className="flex items-center gap-2">
          <Line label="Cuenta / dirección de pago" value={method.account_identifier} />
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={copy} aria-label="Copiar"><Copy className="h-3.5 w-3.5" /></Button>
        </div>
      ) : null}
      {method.instructions ? <p className="mt-1 rounded-lg bg-accent/60 p-2 text-xs text-accent-foreground">{method.instructions}</p> : null}
    </div>
  );
}