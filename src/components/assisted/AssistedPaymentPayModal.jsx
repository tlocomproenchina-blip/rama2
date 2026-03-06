import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, CheckCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AssistedPaymentPayModal({ open, onClose, request, onSubmitted }) {
  const [config, setConfig] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    base44.entities.AppConfig.filter({ config_key: 'main' }).then((cfgs) => setConfig(cfgs?.[0] || null));
    setProofFile(null);
    setReference('');
  }, [open]);

  if (!request) return null;

  const method = request.payment_method;
  const wallets = {
    binance: config?.wallet_binance,
    usdt_trc20: config?.wallet_usdt_trc20,
    paypal: config?.wallet_paypal,
    wally: config?.wallet_wally,
    zinli: config?.wallet_zinli,
    wise: config?.wallet_wise,
    skrill: config?.wallet_skrill,
    pago_movil_usdt: config?.pago_movil_usdt,
  };
  const instructions = {
    binance: config?.binance_instructions,
    usdt_trc20: config?.usdt_instructions,
    paypal: config?.paypal_instructions,
    wally: config?.wally_instructions,
    zinli: config?.zinli_instructions,
    wise: config?.wise_instructions,
    skrill: config?.skrill_instructions,
    pago_movil_usdt: config?.pago_movil_usdt_instructions,
  };

  const wallet = wallets[method] || '';
  const instr = instructions[method] || '';

  const handleSubmit = async () => {
    if (!reference.trim()) {
      toast.error('Ingresa la referencia del pago');
      return;
    }
    setSubmitting(true);
    try {
      let image_url = request.image_url || '';
      if (proofFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: proofFile });
        image_url = file_url;
      }
      await base44.entities.AssistedPaymentRequest.update(request.id, {
        reference: reference.trim(),
        image_url,
      });
      toast.success('Comprobante enviado');
      onSubmitted?.();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('No se pudo enviar el comprobante');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pago Asistido</DialogTitle>
          <DialogDescription>
            Método seleccionado: <strong>{request.payment_method_label || request.payment_method}</strong><br />
            Total a pagar: <strong>${(request.total_amount || 0).toFixed(2)} {request.currency || 'USD'}</strong>
          </DialogDescription>
        </DialogHeader>

        {wallet && (
          <div className="space-y-2 mt-2">
            <Label>Cuenta / Wallet</Label>
            <Input value={wallet} readOnly className="bg-slate-50 font-mono text-sm" />
          </div>
        )}

        {instr && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 mt-2 text-sm text-blue-800 whitespace-pre-wrap">
            {instr}
          </div>
        )}

        <div className="space-y-2 mt-4">
          <Label>Referencia del pago</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej: transacción #1234" />
        </div>

        <div className="space-y-2 mt-3">
          <Label>Comprobante (opcional)</Label>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
            <input type="file" accept="image/*" className="hidden" id="assisted-proof-upload" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
            <label htmlFor="assisted-proof-upload" className="cursor-pointer block">
              {proofFile ? (
                <div className="flex items-center justify-center gap-2 text-emerald-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">{proofFile.name}</span>
                </div>
              ) : (
                <div className="text-slate-500">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">Click para subir imagen del comprobante</p>
                </div>
              )}
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>) : 'Enviar comprobante'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}