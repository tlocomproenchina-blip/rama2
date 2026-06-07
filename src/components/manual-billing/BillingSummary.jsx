import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, FileText } from 'lucide-react';

export default function BillingSummary({
  rows, consolidationMode, setConsolidationMode, manualConsolidationFee, setManualConsolidationFee,
  consolidationFee, shippingTotal, insuranceTotal, total,
  paymentMethod, setPaymentMethod, appConfig, onCreate, creating, canCreate,
}) {
  const selectedCount = rows.filter(r => r.selected).length;
  const totalPackages = rows.filter(r => r.selected).reduce((s, r) => s + (r.package_count || 0), 0);

  return (
    <Card className="border-0 shadow-lg sticky top-4">
      <CardHeader>
        <CardTitle className="text-lg">Resumen de Facturación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600 space-y-1">
          <div className="flex justify-between"><span>Facturas seleccionadas</span><span className="font-medium">{selectedCount}</span></div>
          <div className="flex justify-between"><span>Paquetes totales</span><span className="font-medium">{totalPackages}</span></div>
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

        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between text-slate-600"><span>Envío</span><span>${Number(shippingTotal).toFixed(2)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Consolidación</span><span>${Number(consolidationFee).toFixed(2)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Seguro</span><span>${Number(insuranceTotal).toFixed(2)}</span></div>
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