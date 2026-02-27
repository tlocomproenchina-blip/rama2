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
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableMethods, setAvailableMethods] = useState([]);

  useEffect(() => {
    const loadConfig = async () => {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        setConfig(configs[0]);
        
        // Filter available payment methods based on configuration (with enable flags)
        const c = configs[0];
        const methods = [];
        if (c.payments_enable_stripe !== false) methods.push({ id: 'stripe', name: 'Tarjeta (Stripe)', color: 'indigo' });
        if (c.payments_enable_binance !== false && c.wallet_binance) methods.push({ id: 'binance', name: 'Binance', color: 'amber' });
        if (c.payments_enable_usdt_trc20 !== false && c.wallet_usdt_trc20) methods.push({ id: 'usdt_trc20', name: 'USDT TRC20', color: 'blue' });
        if (c.payments_enable_paypal !== false && c.wallet_paypal) methods.push({ id: 'paypal', name: 'PayPal', color: 'blue' });
        if (c.payments_enable_debito_internacional !== false && c.wallet_debito_internacional) methods.push({ id: 'debito_internacional', name: 'Débito Internacional', color: 'purple' });
        if (c.payments_enable_wally !== false && c.wallet_wally) methods.push({ id: 'wally', name: 'Wally', color: 'green' });
        if (c.payments_enable_zinli !== false && c.wallet_zinli) methods.push({ id: 'zinli', name: 'Zinli', color: 'pink' });
        if (c.payments_enable_wise !== false && c.wallet_wise) methods.push({ id: 'wise', name: 'Wise', color: 'teal' });
        if (c.payments_enable_skrill !== false && c.wallet_skrill) methods.push({ id: 'skrill', name: 'Skrill', color: 'violet' });
        if (c.payments_enable_pago_movil_usdt !== false && c.wallet_pago_movil_usdt) methods.push({ id: 'pago_movil_usdt', name: 'Pago Móvil → USDT', color: 'orange' });
        
        setAvailableMethods(methods);
        if (methods.length > 0) {
          setPaymentMethod(methods[0].id);
        }
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
              {availableMethods.map((method) => (
                <div 
                  key={method.id}
                  className={`flex items-center space-x-2 border rounded-xl p-3 cursor-pointer transition-all ${
                    paymentMethod === method.id 
                      ? `border-${method.color}-400 bg-${method.color}-50` 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <RadioGroupItem value={method.id} id={method.id} />
                  <Label htmlFor={method.id} className="cursor-pointer font-medium text-sm">{method.name}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            {paymentMethod !== 'stripe' && (
              <>
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
              </>
            )}
          </div>

          {getInstructions() && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800">{getInstructions()}</p>
            </div>
          )}

          {/* Monto pagado (ocultar en Stripe, se toma del total) */}
          {paymentMethod !== 'stripe' && (
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
          )}

          {/* Comprobante: no aplica para Stripe */}
          {paymentMethod !== 'stripe' && (
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
          )}
        </div>

        <DialogFooter className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          {paymentMethod === 'stripe' ? (
            <Button
              onClick={async () => {
                try {
                  const cfg = await base44.functions.invoke('getStripeConfig');
                  if (cfg.status !== 200 || !cfg.data?.publishableKey) throw new Error('Stripe no está configurado');
                  const res = await base44.functions.invoke('createStripePaymentIntent', { invoice_id: consolidation.id });
                  if (res.status !== 200 || !res.data?.client_secret) throw new Error(res.data?.error || 'No se pudo iniciar el pago');
                  // Abrimos el modal de Stripe de la página de facturas vía evento
                  window.dispatchEvent(new CustomEvent('openStripeForInvoice', { detail: { clientSecret: res.data.client_secret, publishableKey: cfg.data.publishableKey, invoiceId: consolidation.id } }));
                  onClose();
                } catch (e) {
                  console.error(e);
                  toast.error(e.message || 'No se pudo abrir Stripe');
                }
              }}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Pagar con Tarjeta (Stripe)
            </Button>
          ) : (
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
          )
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}