import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import FileUploadField from './FileUploadField';
import ProviderInstallmentHistory from './ProviderInstallmentHistory';
import { piCall, money, todayLocal } from '@/lib/providerInvoicesApi';

const errMsg = (err, fallback) => err?.response?.data?.error || fallback;

export default function ProviderInstallmentsDialog({ inv, open, onOpenChange, onChanged }) {
  const [data, setData] = useState(inv);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData((await piCall('listInstallments', { id: inv.id })).invoice); }
    catch (err) { toast.error(errMsg(err, 'No se pudieron cargar los abonos')); }
    setLoading(false);
  }, [inv.id]);

  useEffect(() => { if (open) { setAmount(''); setDate(todayLocal()); setProof(''); load(); } }, [open, load]);

  const balance = Number(data.balance ?? data.total) || 0;
  const paidOff = data.status === 'pagada';
  const ready = Number(amount) > 0 && !!date && !!proof;

  const save = async () => {
    setBusy(true);
    try {
      const res = await piCall('addInstallment', { id: inv.id, amount: Number(amount), payment_date: date, proof_url: proof });
      setData(res.invoice); setAmount(''); setProof('');
      toast.success(res.invoice.status === 'pagada' ? 'Abono registrado. Factura pagada por completo' : 'Abono registrado');
      onChanged?.();
    } catch (err) { toast.error(errMsg(err, 'No se pudo registrar el abono')); }
    setBusy(false);
  };

  const remove = async (id) => {
    try {
      const res = await piCall('deleteInstallment', { installment_id: id });
      setData(res.invoice); toast.success('Abono eliminado'); onChanged?.();
    } catch (err) { toast.error(errMsg(err, 'No se pudo eliminar el abono')); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abonos · {inv.invoice_code}</DialogTitle>
          <DialogDescription>{inv.shipping_mark} · {inv.client_name}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['Total', money(data.total), ''], ['Abonado', money(data.paid_amount), 'text-green-700'], ['Saldo', money(balance), balance > 0 ? 'text-destructive' : 'text-green-700']].map(([l, v, c]) => (
            <div key={l} className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">{l}</p><p className={`font-display text-lg font-bold ${c}`}>{v}</p></div>
          ))}
        </div>
        {!paidOff && (
          <div className="space-y-3 rounded-xl border p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Monto del abono (USD)</Label><Input type="number" min="0" step="0.01" max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
              <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </div>
            {Number(amount) > balance + 0.005 && <p className="text-xs text-destructive">El abono supera el saldo pendiente ({money(balance)}).</p>}
            <FileUploadField value={proof} onChange={setProof} label="Cargar comprobante" />
            <Button className="w-full" onClick={save} disabled={!ready || busy || Number(amount) > balance + 0.005}>{busy && <Loader2 className="animate-spin" />}Registrar abono</Button>
          </div>
        )}
        {paidOff && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">Esta factura está pagada por completo.</p>}
        {loading ? <div className="flex justify-center py-4"><Loader2 className="animate-spin text-muted-foreground" /></div> : <ProviderInstallmentHistory items={data.installments || []} onDelete={remove} />}
      </DialogContent>
    </Dialog>
  );
}