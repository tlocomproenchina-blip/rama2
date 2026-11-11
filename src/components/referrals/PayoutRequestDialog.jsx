import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { PAYOUT_METHODS, USD_PER_BLOCK } from '@/lib/referralTerms';

const HINT = {
  usdt_trc20: 'Dirección de billetera USDT TRC20', usdt_bep20: 'Dirección de billetera USDT BEP20',
  pago_movil: 'Banco, teléfono y cédula del titular', efectivo: 'Nota opcional para el retiro', credito: 'Nota opcional',
};

export default function PayoutRequestDialog({ open, onOpenChange, maxBlocks, onDone }) {
  const [blocks, setBlocks] = useState(1);
  const [method, setMethod] = useState('credito');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    const { data } = await base44.functions.invoke('referralProgram', { action: 'request_payout', blocks, method, payout_details: details })
      .catch((e) => ({ data: e?.response?.data || { error: 'No se pudo enviar' } }));
    setBusy(false);
    if (data?.error) return setError(data.error);
    onOpenChange(false); setDetails(''); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Solicitar cobro</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Bloques de 1 CBM (máx. {maxBlocks})</Label>
            <Input type="number" min={1} max={maxBlocks} value={blocks} onChange={(e) => setBlocks(Math.max(1, Math.min(maxBlocks, Number(e.target.value) || 1)))} />
            <p className="text-sm text-muted-foreground">Total: <b>${blocks * USD_PER_BLOCK} USD</b></p>
          </div>
          <div className="space-y-1.5">
            <Label>Modalidad</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PAYOUT_METHODS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{HINT[method]}</Label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} />
          </div>
          {method !== 'credito' && <p className="text-xs text-muted-foreground">Los retiros monetarios se procesan dentro de 5 días hábiles tras la aprobación.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Enviar solicitud</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}