import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { base44 } from '@/api/base44Client';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';
import { Shield, Copy, Upload, CheckCircle, Loader2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import PagoMovilBsDisplay from '@/components/payments/PagoMovilBsDisplay';

export default function InsurancePaymentModal({
  open,
  onClose,
  trackingNumber,
  fobValue,
  insurancePercentage,
  formData,
  user,
  onPaid,
  onSkip,
  mode = 'create',
  pkg = null,
  mandatory = false
}) {
  const [config, setConfig] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableMethods, setAvailableMethods] = useState([]);

  const effectivePercentage = insurancePercentage || config?.insurance_percentage || 5;
  const insuranceAmount = fobValue
    ? (parseFloat(fobValue) * (effectivePercentage / 100))
    : 0;

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
        if (c.payments_enable_transferencia === true) methods.push({ id: 'transferencia', name: 'Transferencia', color: 'slate' });
        setAvailableMethods(methods);
        if (methods.length > 0) setPaymentMethod(methods[0].id);
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
      wally: config.wallet_wally,
      zinli: config.wallet_zinli,
      wise: config.wallet_wise,
      skrill: config.wallet_skrill,
      pago_movil_usdt: config.wallet_pago_movil_usdt,
      transferencia: ''
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
      pago_movil_usdt: config.pago_movil_usdt_instructions,
      transferencia: ''
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
      toast.error('Por favor sube el comprobante de pago del seguro');
      return;
    }
    setUploading(true);
    try {
      const proofUrl = await uploadImageNoCredits(proofFile);

      if (mode === 'retry' && pkg) {
        const { data } = await base44.functions.invoke('retryInsurancePayment', {
          package_id: pkg.id,
          proof_url: proofUrl,
          method: paymentMethod
        });
        toast.success('Comprobante enviado. El pago está pendiente de validación.');
        onPaid(pkg, data?.insurance_payment);
      } else {
        const { data } = await base44.functions.invoke('createInsuredPrealert', {
          shipping_company: formData.shipping_company,
          tracking_number: formData.tracking_number,
          shipping_type: formData.shipping_type,
          risk_category: formData.risk_category,
          package_count: Number(formData.package_count),
          description: formData.description,
          fob_value: parseFloat(formData.fob_value),
          invoice_url: formData.invoice_url || null,
          product_image_url: formData.product_image_url || null,
          insurance_percentage: insurancePercentage,
          insurance_amount: insuranceAmount,
          payment_method: paymentMethod,
          proof_url: proofUrl,
          label_code: formData.label_code || undefined
        });
        toast.success('Pre-alerta creada con seguro. El pago está pendiente de validación.');
        onPaid(data?.package, data?.insurance_payment);
      }
    } catch (error) {
      console.error('Error creating insured pre-alert:', error);
      toast.error(error?.response?.data?.error || 'Error al crear la pre-alerta asegurada');
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) { if (mode === 'retry') onClose(); else onSkip(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Shield className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-800">
                {mode === 'retry' ? 'Pagar Seguro Nuevamente' : 'Pagar Seguro de Envío'}
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Seguro de <span className="font-bold text-emerald-600">${insuranceAmount.toFixed(2)}</span> · Tracking: <span className="font-mono font-semibold">{trackingNumber}</span>
              </DialogDescription>
              <p className="text-xs text-slate-500 mt-1">Cobertura: 5% del valor FOB (${parseFloat(fobValue || 0).toFixed(2)}).</p>
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
                  <RadioGroupItem value={method.id} id={`ins-${method.id}`} />
                  <Label htmlFor={`ins-${method.id}`} className="cursor-pointer font-medium text-sm">{method.name}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {paymentMethod !== 'transferencia' && paymentMethod !== 'pago_movil_usdt' && (
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">
                {['paypal', 'wally', 'zinli', 'wise', 'skrill'].includes(paymentMethod)
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
          )}
          {paymentMethod === 'pago_movil_usdt' && (
            <PagoMovilBsDisplay config={config} amountUsd={insuranceAmount} />
          )}

          {getInstructions() && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800">{getInstructions()}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Monto del Seguro
            </Label>
            <Input
              type="number"
              step="0.01"
              value={insuranceAmount.toFixed(2)}
              readOnly
              className="bg-slate-100 cursor-not-allowed"
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
                id="insurance-proof-upload"
              />
              <label htmlFor="insurance-proof-upload" className="cursor-pointer">
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
          {(!mandatory || mode === 'retry') && (
            <Button variant="outline" onClick={mode === 'retry' ? onClose : onSkip} className="flex-1">
              {mode === 'retry' ? 'Cancelar' : 'No pagar ahora'}
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={uploading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              mode === 'retry' ? 'Confirmar Pago' : 'Confirmar y Crear Pre-alerta'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}