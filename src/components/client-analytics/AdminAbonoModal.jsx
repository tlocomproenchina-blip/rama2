import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle, DollarSign, Loader2, Upload, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';
import { ABONO_METHODS } from '@/lib/abonoMethods';
import { billableTotal } from '@/lib/storageLines';

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) => `$${num(value).toFixed(2)}`;

// Abono registrado por el administrador desde la analítica del cliente. Se guarda
// como abono de la factura y se aprueba de inmediato con el mismo flujo oficial de
// aprobación, así la factura, su saldo y su orden de almacén quedan idénticas a
// como si se hubieran aprobado desde el panel de pagos.
export default function AdminAbonoModal({ open, onClose, invoice, paidAmount = 0, balance = 0, onSaved }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('transferencia');
  const [reference, setReference] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(num(balance).toFixed(2));
    setMethod('transferencia');
    setReference('');
    setProofFile(null);
    setError('');
  }, [open, balance]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) setProofFile(file);
  };

  const submit = async () => {
    const amt = num(parseFloat(amount || '0').toFixed(2));
    if (!amt || amt <= 0) {
      setError('Ingresa un monto válido');
      return;
    }
    const saldoPendiente = num(balance);
    if (saldoPendiente <= 0.01) {
      setError('Esta factura no tiene saldo pendiente');
      return;
    }
    // Un abono mayor al saldo pendiente se reparte: lo que cubre la factura entra
    // como abono y el excedente queda como saldo a favor del cliente, que se aplica
    // a su próxima factura.
    const invoiceAmount = Math.min(amt, saldoPendiente);
    const excess = num((amt - invoiceAmount).toFixed(2));

    setSaving(true);
    setError('');
    try {
      const proofUrl = proofFile ? await uploadImageNoCredits(proofFile) : '';

      const payment = await base44.entities.InvoicePayment.create({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number || '',
        client_email: invoice.client_email,
        amount: invoiceAmount,
        method,
        proof_url: proofUrl,
        reference: reference.trim(),
        reported_date: new Date().toISOString(),
        status: 'pendiente',
      });

      const res = await base44.functions.invoke('approveInvoicePayment', { payment_id: payment.id });
      if (res?.data?.error) throw new Error(res.data.error);

      // El excedente queda como saldo a favor del cliente y se aplica de una vez a
      // su próxima factura pendiente.
      let creditNotice = '';
      if (excess > 0) {
        const creditRes = await base44.functions.invoke('addClientCredit', {
          client_email: invoice.client_email,
          amount: excess,
          type: 'credito',
          description: `Saldo a favor del abono de ${money(amt)} sobre la factura ${invoice.invoice_number || invoice.id}`,
          reference: reference.trim(),
        });
        if (creditRes?.data?.error) throw new Error(creditRes.data.error);
        const applied = creditRes?.data?.applied || [];
        creditNotice = applied.length > 0
          ? ` ${money(excess)} quedaron a favor del cliente y se aplicaron a la factura ${applied.map((item) => item.invoice_number || item.invoice_id).join(', ')}.`
          : ` ${money(excess)} quedaron a favor del cliente para su próxima factura.`;
      }

      const statusNotice = invoiceAmount < num(balance) - 0.01
        ? `Saldo restante: ${money(Math.max(num(balance) - invoiceAmount, 0))}.`
        : 'La factura quedó pagada.';
      toast.success(`Abono de ${money(amt)} registrado. ${statusNotice}${creditNotice}`);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e?.message || 'No se pudo registrar el abono');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onClose(value)}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2">
              <Wallet className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-800">Registrar abono</DialogTitle>
              <DialogDescription className="text-slate-500">
                Factura: <span className="font-mono">{invoice?.invoice_number || '—'}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 py-2">
          <div className="rounded-lg bg-slate-50 p-2 text-center">
            <p className="text-xs text-slate-500">Total</p>
            <p className="font-bold text-slate-800">{money(billableTotal(invoice))}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2 text-center">
            <p className="text-xs text-emerald-600">Abonado</p>
            <p className="font-bold text-emerald-700">{money(paidAmount)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-2 text-center">
            <p className="text-xs text-amber-600">Saldo</p>
            <p className="font-bold text-amber-700">{money(balance)}</p>
          </div>
        </div>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 font-medium text-slate-700">
              <DollarSign className="h-4 w-4" /> Monto del abono
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-slate-500">Puedes abonar cualquier monto: lo que exceda el saldo pendiente queda a favor del cliente y se aplica a su próxima factura.</p>
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-slate-700">Método de pago</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ABONO_METHODS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-medium text-slate-700">Referencia (opcional)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Número de transacción, voucher, etc."
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 font-medium text-slate-700">
              <Upload className="h-4 w-4" /> Comprobante (opcional)
            </Label>
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-center transition-colors hover:border-blue-400">
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="admin-abono-proof" />
              <label htmlFor="admin-abono-proof" className="cursor-pointer">
                {proofFile ? (
                  <span className="flex items-center justify-center gap-2 text-emerald-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">{proofFile.name}</span>
                  </span>
                ) : (
                  <span className="block text-slate-500">
                    <Upload className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                    <span className="text-sm">Click para subir la imagen del comprobante</span>
                  </span>
                )}
              </label>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <p className="text-xs text-slate-500">
            El abono queda aprobado de inmediato y el saldo de la factura se actualiza al guardarlo.
          </p>
        </div>

        <DialogFooter className="flex gap-3">
          <Button variant="outline" onClick={() => onClose()} disabled={saving} className="flex-1">Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Registrar abono'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}