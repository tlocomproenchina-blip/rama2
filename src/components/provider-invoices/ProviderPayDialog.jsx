import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import FileUploadField from './FileUploadField';
import { piCall, money, todayLocal } from '@/lib/providerInvoicesApi';

export default function ProviderPayDialog({ invoices, open, onOpenChange, onPaid }) {
  const [date, setDate] = useState(todayLocal);
  const [mode, setMode] = useState('shared');
  const [shared, setShared] = useState('');
  const [proofs, setProofs] = useState({});
  const [busy, setBusy] = useState(false);
  const many = invoices.length > 1;
  const total = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);

  useEffect(() => { if (open) { setDate(todayLocal()); setMode('shared'); setShared(''); setProofs({}); } }, [open]);

  const proofFor = (inv) => (mode === 'shared' || !many ? shared : proofs[inv.id]);
  const ready = !!date && invoices.every((i) => proofFor(i));

  const save = async () => {
    setBusy(true);
    try {
      await piCall('markPaidBulk', { paid_date: date, items: invoices.map((i) => ({ id: i.id, payment_proof_url: proofFor(i) })) });
      toast.success(many ? `${invoices.length} facturas marcadas como pagadas` : 'Factura marcada como pagada');
      onOpenChange(false); onPaid?.();
    } catch (err) { toast.error(err?.response?.data?.error || 'No se pudo registrar el pago'); }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>{invoices.length} factura{many ? 's' : ''} · Total {money(total)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Fecha de pago</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {many && (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              {[['shared', 'Un comprobante para todas'], ['individual', 'Uno por factura']].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${mode === k ? 'bg-card shadow-card' : 'text-muted-foreground'}`}>{l}</button>
              ))}
            </div>
          )}
          {mode === 'shared' || !many ? <FileUploadField value={shared} onChange={setShared} label="Cargar comprobante" /> : (
            <div className="max-h-72 space-y-3 overflow-y-auto">
              {invoices.map((i) => (
                <div key={i.id} className="rounded-xl border p-3">
                  <p className="mb-2 text-sm font-medium">{i.invoice_code} · {i.client_name || i.shipping_mark} · {money(i.total)}</p>
                  <FileUploadField value={proofs[i.id] || ''} onChange={(v) => setProofs((p) => ({ ...p, [i.id]: v }))} label="Cargar comprobante" />
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!ready || busy}>{busy && <Loader2 className="animate-spin" />}Guardar pago</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}