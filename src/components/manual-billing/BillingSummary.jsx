import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, FileText } from 'lucide-react';
import ProviderInvoiceUploader from '@/components/manual-billing/ProviderInvoiceUploader';

export default function BillingSummary({
  rows, consolidationMode, setConsolidationMode, manualConsolidationFee, setManualConsolidationFee,
  consolidationFee, shippingTotal, insuranceTotal, total,
  autoInsuranceTotal, manualInsurance, setManualInsurance,
  paymentMethod, setPaymentMethod, appConfig, onCreate, creating, canCreate,
  billedCbm, setBilledCbm,
  providerInvoiceUrl, setProviderInvoiceUrl,
  manualReceiptNumber, setManualReceiptNumber,
  extraAmount, setExtraAmount,
  extraConcept, setExtraConcept,
  doorToDoorFee, setDoorToDoorFee,
}) {
  const selected = rows.filter(r => r.selected);
  const selectedCount = selected.length;
  const totalPackages = selected.reduce((s, r) => s + (r.package_count || 0), 0);
  const totalCbm = selected.reduce((s, r) => s + (Number(r.cbm) || 0), 0);

  return (
    <Card className="border-0 shadow-lg sticky top-4">
      <CardHeader>
        <CardTitle className="text-lg">Resumen de Facturación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600 space-y-1">
          <div className="flex justify-between"><span>Facturas seleccionadas</span><span className="font-medium">{selectedCount}</span></div>
          <div className="flex justify-between"><span>Paquetes totales</span><span className="font-medium">{totalPackages}</span></div>
          <div className="flex justify-between"><span>CBM total</span><span className="font-bold text-blue-700">{totalCbm.toFixed(5)} CBM</span></div>
        </div>

        <div className="space-y-2 border-t pt-3">
          <Label className="text-sm">CBM facturado (manual)</Label>
          <Input
            type="number" step="0.0001" min="0"
            value={billedCbm}
            onChange={(e) => setBilledCbm(e.target.value)}
            placeholder={`Ej: ${totalCbm.toFixed(5)}`}
          />
          <p className="text-xs text-slate-500">CBM que se mostrará en la factura. Déjalo vacío para usar el CBM total.</p>
        </div>

        <div className="space-y-2 border-t pt-3">
          <Label className="text-sm">Número de recibo nuevo (opcional)</Label>
          <Input
            value={manualReceiptNumber || ''}
            onChange={(e) => setManualReceiptNumber(e.target.value)}
            placeholder="Ej: 272"
          />
          <p className="text-xs text-slate-500">Permite facturar sin seleccionar registros. El recibo se registrará automáticamente con el CBM facturado.</p>
        </div>

        <div className="space-y-2 border-t pt-3">
          <Label className="text-sm">Servicio de consolidación</Label>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Manual</span>
            <Switch
              checked={consolidationMode === 'manual'}
              onCheckedChange={(c) => setConsolidationMode(c ? 'manual' : 'auto')}
            />
          </div>
          {consolidationMode === 'manual' ? (
            <Input
              type="number" step="0.01" min="0"
              value={manualConsolidationFee}
              onChange={(e) => setManualConsolidationFee(e.target.value)}
              placeholder="Monto manual"
            />
          ) : (
            <p className="text-xs text-slate-500">Automático: $1 × {totalPackages} paquete(s) = ${Number(consolidationFee).toFixed(2)}</p>
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <Label className="text-sm">Monto del seguro</Label>
          <Input
            type="number" step="0.01" min="0"
            value={manualInsurance}
            onChange={(e) => setManualInsurance(e.target.value)}
            placeholder={`Auto: $${Number(autoInsuranceTotal || 0).toFixed(2)}`}
          />
          <p className="text-xs text-slate-500">Déjalo vacío para usar el 5% del FOB calculado automáticamente.</p>
        </div>

        <div className="space-y-2 border-t pt-3">
          <Label className="text-sm">Envío puerta a puerta</Label>
          <Input
            type="number" step="0.01" min="0"
            value={doorToDoorFee || ''}
            onChange={(e) => setDoorToDoorFee(e.target.value)}
            placeholder="Ej: 10.00"
          />
          <p className="text-xs text-slate-500">Tarifa opcional de envío puerta a puerta. Se agrega como línea en la factura.</p>
        </div>

        <div className="space-y-2 border-t pt-3">
          <Label className="text-sm">Monto adicional a cobrar</Label>
          <Input
            value={extraConcept || ''}
            onChange={(e) => setExtraConcept(e.target.value)}
            placeholder="Concepto (Ej: Embalaje especial)"
          />
          <Input
            type="number" step="0.01" min="0"
            value={extraAmount || ''}
            onChange={(e) => setExtraAmount(e.target.value)}
            placeholder="Monto (Ej: 5.00)"
          />
          <p className="text-xs text-slate-500">Cargo extra opcional con su concepto. Se agrega como línea en la factura.</p>
        </div>

        <div className="space-y-2 border-t pt-3">
          <Label className="text-sm">Método de pago</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue placeholder="Selecciona método" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stripe_invoice">Stripe (tarjeta)</SelectItem>
              {appConfig?.payments_enable_binance !== false && <SelectItem value="binance">Binance</SelectItem>}
              {appConfig?.payments_enable_usdt_trc20 !== false && <SelectItem value="usdt_trc20">USDT TRC20</SelectItem>}
              {appConfig?.payments_enable_paypal !== false && <SelectItem value="paypal">PayPal</SelectItem>}
              {appConfig?.payments_enable_debito_internacional !== false && <SelectItem value="debito_internacional">Débito Internacional</SelectItem>}
              {appConfig?.payments_enable_wally !== false && <SelectItem value="wally">Wally</SelectItem>}
              {appConfig?.payments_enable_zinli !== false && <SelectItem value="zinli">Zinli</SelectItem>}
              {appConfig?.payments_enable_wise !== false && <SelectItem value="wise">Wise</SelectItem>}
              {appConfig?.payments_enable_skrill !== false && <SelectItem value="skrill">Skrill</SelectItem>}
              {appConfig?.payments_enable_pago_movil_usdt !== false && <SelectItem value="pago_movil_usdt">Pago Móvil → USDT</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        <ProviderInvoiceUploader value={providerInvoiceUrl} onChange={setProviderInvoiceUrl} />

        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between text-slate-600"><span>Envío</span><span>${Number(shippingTotal).toFixed(2)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Consolidación</span><span>${Number(consolidationFee).toFixed(2)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Seguro</span><span>${Number(insuranceTotal).toFixed(2)}</span></div>
          {Number(doorToDoorFee) > 0 && (
            <div className="flex justify-between text-slate-600"><span>Puerta a puerta</span><span>${Number(doorToDoorFee).toFixed(2)}</span></div>
          )}
          {Number(extraAmount) > 0 && (
            <div className="flex justify-between text-slate-600"><span>{String(extraConcept || '').trim() || 'Monto adicional'}</span><span>${Number(extraAmount).toFixed(2)}</span></div>
          )}
          <div className="flex justify-between text-lg font-bold text-slate-800 border-t pt-2 mt-1">
            <span>Total</span><span>${Number(total).toFixed(2)}</span>
          </div>
        </div>

        <Button
          onClick={onCreate}
          disabled={!canCreate || creating}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          Generar Factura
        </Button>
      </CardContent>
    </Card>
  );
}