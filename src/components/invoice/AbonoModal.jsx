import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { base44 } from '@/api/base44Client';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';
import { Wallet, Copy, Upload, CheckCircle, Loader2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export default function AbonoModal({ open, onClose, invoice, onSubmitted }) {
  const [config, setConfig] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableMethods, setAvailableMethods] = useState([]);
  const [reference, setReference] = useState('');

  const total = Number(invoice?.total || 0);
  const paidAmount = Number(invoice?.paid_amount || 0);
  const balance = Math.max(0, total - paidAmount);

  useEffect(() => {
    const loadConfig = async () => {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        setConfig(configs[0]);
        const c = configs[0];
        const methods = [];
        if (c.payments_enable_binance === true && c.wallet_binance) methods.push({ id: 'binance', name: 'Binance', color: 'amber' });
        if (c.payments_enable_usdt_trc20 === true && c.wallet_usdt_trc20) methods.push({ id: 'usdt_trc20', name: 'USDT TRC20', color: 'blue' });
        if (c.payments_enable_paypal === true && c.wallet_paypal) methods.push({ id: 'paypal', name: 'PayPal', color: 'blue' });
        if (c.payments_enable_wally === true && c.wallet_wally) methods.push({ id: 'wally', name: 'Wally', color: 'green' });
        if (c.payments_enable_zinli === true && c.wallet_zinli) methods.push({ id: 'zinli', name: 'Zinli', color: 'pink' });
        if (c.payments_enable_wise === true && c.wallet_wise) methods.push({ id: 'wise', name: 'Wise', color: 'teal' });
        if (c.payments_enable_skrill === true && c.wallet_skrill) methods.push({ id: 'skrill', name: 'Skrill', color: 'violet' });
        if (c.payments_enable_pago_movil_usdt === true && c.wallet_pago_movil_usdt) methods.push({ id: 'pago_movil_usdt', name: 'Pago Móvil → USDT', color: 'orange' });
        methods.push({ id: 'transferencia', name: 'Transferencia', color: 'slate' });
        setAvailableMethods(methods);
        if (methods.length > 0) setPaymentMethod(methods[0].id);
      }
      setLoading(false);
    };
    if (open) {
      loadConfig();
      setAmount(balance.toFixed(2));
      setProofFile(null);
      setReference('');
    }
  }, [open]);

  const getWalletAddress = () => {
    if (!config) return '';
    const walletMap = {
      binance: config.wallet_binance,
      usdt_trc20: config.wallet_usdt_trc20,
      paypal: config.wallet_paypal,
      wally: config.wallet_wally,
      zinli: config.wallet_zinli,
      wise: config.wallet_wise,
      skrill: config.wallet_skrill,
      pago_movil_usdt: config.wallet_pago_movil_usdt
    };
    return walletMap[paymentMethod] || '';
  };

  const getInstructions = () => {
    if (!config) return '';
    const instructionsMap = {
      binance: config.binance_instructions,
      usdt_trc20: config.usdt_instructions,
      paypal: config.paypal_instructions,
      wally: config.wally_instructions,
      zinli: config.zinli_instructions,
      wise: config.wise_instructions,
      skrill: config.skrill_instructions,
      pago_movil_usdt: config.pago_movil_usdt_instructions
    };
    return instructionsMap[paymentMethod] || '';
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getWalletAddress());
    toast.success('Dirección copiada al portapapeles');
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setProofFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    const amt = parseFloat(amount || '0');
    if (!amt || amt <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    if (amt > balance + 0.01) {
      toast.error(`El monto no puede superar el saldo pendiente ($${balance.toFixed(2)})`);
      return;
    }
    if (!proofFile) {
      toast.error('Por favor sube el comprobante de pago');
      return;
    }

    setUploading(true);
    try {
      const file_url = await uploadImageNoCredits(proofFile);

      await base44.entities.InvoicePayment.create({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number || '',
        client_email: invoice.client_email,
        amount: amt,
        method: paymentMethod,
        proof_url: file_url,
        reference: reference || '',
        status: 'pendiente'
      });

      toast.success('¡Abono registrado! Queda pendiente de validación por el administrador.');

      // Notificación al cliente
      try {
        await base44.entities.Notification.create({
          user_email: invoice.client_email,
          title: '✅ Abono registrado',
          message: `Tu abono de $${amt.toFixed(2)} para la factura ${invoice.invoice_number || ''} fue registrado y está pendiente de validación.`,
          type: 'payment',
          icon: 'check',
          reference_id: invoice.id,
          entity_type: 'Invoice'
        });
      } catch (_) {}

      // Notificar admins
      try {
        const r = await base44.functions.invoke('listAdmins', {});
        const admins = (r?.data?.admins) || [];
        for (const admin of admins) {
          await base44.entities.Notification.create({
            user_email: admin.email,
            title: '💳 Nuevo abono pendiente',
            message: `Abono de $${amt.toFixed(2)} para factura ${invoice.invoice_number || ''} pendiente de validación.`,
            type: 'payment_validation',
            icon: 'dollar',
            reference_id: invoice.id,
            entity_type: 'Invoice'
          }).catch(() => {});
        }
      } catch (_) {}

      onSubmitted?.();
      onClose();
    } catch (error) {
      console.error('Error submitting abono:', error);
      toast.error(error?.message || 'Error al registrar el abono. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Wallet className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-800">
                Registrar Abono
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Factura: <span className="font-mono">{invoice?.invoice_number}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Resumen de saldos */}
        <div className="grid grid-cols-3 gap-2 py-2">
          <div className="rounded-lg bg-slate-50 p-2 text-center">
            <p className="text-xs text-slate-500">Total</p>
            <p className="font-bold text-slate-800">${total.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2 text-center">
            <p className="text-xs text-emerald-600">Pagado</p>
            <p className="font-bold text-emerald-700">${paidAmount.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-2 text-center">
            <p className="text-xs text-amber-600">Saldo</p>
            <p className="font-bold text-amber-700">${balance.toFixed(2)}</p>
          </div>
        </div>

        <div className="space-y-5 py-2">
          {/* Monto del abono */}
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Monto del Abono
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-slate-500">Puedes abonar cualquier monto hasta el saldo pendiente.</p>
          </div>

          {/* Método de pago */}
          <div className="space-y-3">
            <Label className="text-slate-700 font-medium">Método de Pago</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-3">
              {availableMethods.map((method) => (
                <div
                  key={method.id}
                  className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-all ${
                    paymentMethod === method.id
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <RadioGroupItem value={method.id} id={`abono-${method.id}`} />
                  <Label htmlFor={`abono-${method.id}`} className="cursor-pointer font-medium text-sm">{method.name}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Datos de wallet */}
          {getWalletAddress() && (
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">
                {['paypal', 'wally', 'zinli', 'wise', 'skrill', 'pago_movil_usdt'].includes(paymentMethod)
                  ? 'Datos de Pago'
                  : 'Dirección de Wallet'}
              </Label>
              <div className="flex gap-2">
                <Input
                  value={getWalletAddress()}
                  readOnly
                  className="bg-slate-50 font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {getInstructions() && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800">{getInstructions()}</p>
            </div>
          )}

          {/* Referencia opcional */}
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Referencia (opcional)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Número de transacción, voucher, etc."
            />
          </div>

          {/* Comprobante */}
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium flex items-center gap-2">
              <Upload className="h-4 w-4" /> Comprobante de Pago
            </Label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="abono-proof-upload"
              />
              <label htmlFor="abono-proof-upload" className="cursor-pointer">
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
        </div>

        <DialogFooter className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={uploading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              'Registrar Abono'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}