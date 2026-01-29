import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { base44 } from '@/api/base44Client';
import { Wallet, Copy, Upload, CheckCircle, Loader2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

export default function PaymentModal({ open, onClose, consolidation, onPaymentSubmitted }) {
  const [config, setConfig] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('binance');
  const [amount, setAmount] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        setConfig(configs[0]);
      }
      setLoading(false);
    };
    if (open) loadConfig();
  }, [open]);

  const getWalletAddress = () => {
    if (!config) return '';
    const walletMap = {
      binance: config.wallet_binance,
      usdt_trc20: config.wallet_usdt_trc20,
      paypal: config.wallet_paypal,
      debito_internacional: config.wallet_debito_internacional,
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
      debito_internacional: config.debito_internacional_instructions,
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
    if (!proofFile) {
      toast.error('Por favor sube el comprobante de pago');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Por favor ingresa el monto pagado');
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: proofFile });

      await base44.entities.Consolidation.update(consolidation.id, {
        payment_proof_url: file_url,
        payment_amount: parseFloat(amount),
        payment_method: paymentMethod,
        payment_date: new Date().toISOString(),
        status: 'pago_pendiente_validacion'
      });

      toast.success('¡Gracias! Tu comprobante fue enviado y será verificado en breve.');

      // Notify admin (async, don't wait)
      base44.entities.User.filter({ role: 'admin' }).then(admins => {
        admins.forEach(admin => {
          base44.integrations.Core.SendEmail({
            to: admin.email,
            subject: '💳 Nuevo pago reportado',
            body: `Un cliente ha reportado un pago para la consolidación ${consolidation.consolidation_tracking}.\n\nMonto: $${amount}\nMétodo: ${paymentMethod}\n\nPor favor revisa y valida el pago.`
          }).catch(err => console.error('Email error:', err));

          base44.entities.Notification.create({
            user_email: admin.email,
            title: '💳 Nuevo Pago Reportado',
            message: `Pago de $${amount} para ${consolidation.consolidation_tracking} pendiente de validación`,
            type: 'payment',
            icon: 'dollar',
            reference_id: consolidation.id
          }).catch(err => console.error('Notification error:', err));
        });
      }).catch(err => console.error('Admin fetch error:', err));

      onPaymentSubmitted();
      onClose();
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error('Error al enviar el pago');
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Wallet className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-800">
                Pagar Consolidación
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Total a pagar: <span className="font-bold text-emerald-600">${consolidation?.total_cost?.toFixed(2)}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-slate-700 font-medium">Método de Pago</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-3">
              <div className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-all ${paymentMethod === 'binance' ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <RadioGroupItem value="binance" id="binance" />
                <Label htmlFor="binance" className="cursor-pointer font-medium text-sm">Binance</Label>
              </div>
              <div className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-all ${paymentMethod === 'usdt_trc20' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <RadioGroupItem value="usdt_trc20" id="usdt_trc20" />
                <Label htmlFor="usdt_trc20" className="cursor-pointer font-medium text-sm">USDT TRC20</Label>
              </div>
              <div className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-all ${paymentMethod === 'paypal' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <RadioGroupItem value="paypal" id="paypal" />
                <Label htmlFor="paypal" className="cursor-pointer font-medium text-sm">PayPal</Label>
              </div>
              <div className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-all ${paymentMethod === 'debito_internacional' ? 'border-purple-400 bg-purple-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <RadioGroupItem value="debito_internacional" id="debito_internacional" />
                <Label htmlFor="debito_internacional" className="cursor-pointer font-medium text-sm">Débito Internacional</Label>
              </div>
              <div className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-all ${paymentMethod === 'wally' ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <RadioGroupItem value="wally" id="wally" />
                <Label htmlFor="wally" className="cursor-pointer font-medium text-sm">Wally</Label>
              </div>
              <div className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-all ${paymentMethod === 'zinli' ? 'border-pink-400 bg-pink-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <RadioGroupItem value="zinli" id="zinli" />
                <Label htmlFor="zinli" className="cursor-pointer font-medium text-sm">Zinli</Label>
              </div>
              <div className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-all ${paymentMethod === 'wise' ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <RadioGroupItem value="wise" id="wise" />
                <Label htmlFor="wise" className="cursor-pointer font-medium text-sm">Wise</Label>
              </div>
              <div className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-all ${paymentMethod === 'skrill' ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <RadioGroupItem value="skrill" id="skrill" />
                <Label htmlFor="skrill" className="cursor-pointer font-medium text-sm">Skrill</Label>
              </div>
              <div className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-all ${paymentMethod === 'pago_movil_usdt' ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <RadioGroupItem value="pago_movil_usdt" id="pago_movil_usdt" />
                <Label htmlFor="pago_movil_usdt" className="cursor-pointer font-medium text-sm">Pago Móvil → USDT</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">
              {['paypal', 'debito_internacional', 'wally', 'zinli', 'wise', 'skrill', 'pago_movil_usdt'].includes(paymentMethod) 
                ? 'Datos de Pago' 
                : 'Dirección de Wallet'}
            </Label>
            <div className="flex gap-2">
              <Input 
                value={getWalletAddress() || 'No configurado'} 
                readOnly 
                className="bg-slate-50 font-mono text-sm"
              />
              {getWalletAddress() && (
                <Button variant="outline" size="icon" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {getInstructions() && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800">{getInstructions()}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-slate-700 font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Monto Pagado
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

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
                id="proof-upload"
              />
              <label htmlFor="proof-upload" className="cursor-pointer">
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
              'Confirmar Pago'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}