import React from 'react';
import { Warehouse } from 'lucide-react';
import { storageBalance, DAILY_STORAGE_FEE } from '@/lib/storageBalance';

export default function InvoiceStorageBalance({ invoice }) {
  const s = storageBalance(invoice);
  if (!s.active) return null;
  const Row = ({ label, value, strong }) => (
    <div className={`flex justify-between gap-2 ${strong ? 'font-semibold text-foreground border-t pt-2' : 'text-muted-foreground'}`}>
      <span>{label}</span><span className="shrink-0">${value.toFixed(2)}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm space-y-1.5">
      <div className="flex items-center gap-2 font-semibold text-amber-800">
        <Warehouse className="h-4 w-4" /> Almacenamiento y custodia · día {s.day}
      </div>
      <Row label="Saldo de la factura" value={s.balance} />
      <Row label="Cargo único (día 8)" value={s.minFee} />
      <Row label={`Cargos diarios (${s.dailyDays} × $${DAILY_STORAGE_FEE})`} value={s.dailyFee} />
      <Row label="Total a pagar" value={s.total} strong />
      <p className="text-xs text-muted-foreground">Según los Términos y Condiciones (sección VII). Se detiene al registrar el pago.</p>
    </div>
  );
}