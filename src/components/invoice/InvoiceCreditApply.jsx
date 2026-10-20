import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Wallet, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { billableTotal } from '@/lib/storageLines';

/**
 * Muestra el saldo a favor disponible del cliente y permite aplicarlo
 * a la factura pendiente actual. Solo se muestra cuando:
 * - La factura está pendiente o en revisión
 * - Queda saldo por pagar
 * - El cliente tiene saldo a favor > 0
 */
export default function InvoiceCreditApply({ invoice, onApplied }) {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const total = billableTotal(invoice);
  const paid = Number(invoice.paid_amount || 0);
  const debt = Math.max(0, total - paid);
  const isPending = invoice.status === 'pendiente' || invoice.status === 'revision';

  useEffect(() => {
    if (!isPending || debt <= 0.01 || !invoice.client_email) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    base44.entities.ClientCredit.filter({ client_email: invoice.client_email })
      .then((credits) => {
        if (cancelled) return;
        const sum = credits.reduce((s, c) => s + (Number(c.amount) || 0), 0);
        setBalance(sum);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [invoice.id, invoice.status, invoice.paid_amount, invoice.client_email]);

  if (!isPending || debt <= 0.01 || loading || balance <= 0.01) return null;

  const wouldApply = Math.min(balance, debt);

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await base44.functions.invoke('applyClientCreditToInvoice', { invoice_id: invoice.id });
      const applied = res?.data?.applied || [];
      const match = applied.find((a) => a.invoice_id === invoice.id);
      if (match) {
        toast.success(
          `Saldo a favor aplicado: -$${Number(match.applied).toFixed(2)}${match.fully_paid ? ' · Factura pagada' : ''}`,
          { duration: 6000 }
        );
      } else {
        toast.info('No se aplicó saldo a esta factura (puede que ya esté pagada)');
      }
      if (onApplied) onApplied();
    } catch {
      toast.error('No se pudo aplicar el saldo a favor');
    }
    setApplying(false);
  };

  return (
    <div className="mb-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-emerald-800 min-w-0">
        <Wallet className="h-4 w-4 shrink-0" />
        <span className="min-w-0">
          Tienes <strong className="font-semibold">${balance.toFixed(2)}</strong> de saldo a favor.
          Se aplicará <strong>${wouldApply.toFixed(2)}</strong> a esta factura.
        </span>
      </div>
      <Button
        size="sm"
        onClick={handleApply}
        disabled={applying}
        className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
      >
        {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        {applying ? 'Aplicando...' : 'Aplicar saldo'}
      </Button>
    </div>
  );
}