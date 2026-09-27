import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Receipt, Loader2 } from 'lucide-react';

const money = (v) => `$${Number(v || 0).toFixed(2)}`;

export default function WarehouseBillingSummary({
  totals, overrides, setOverride, onCreate, creating, canCreate, clientName,
}) {
  return (
    <Card className="border-border/70 shadow-card lg:sticky lg:top-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" /> Resumen de la factura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-500">
          Cliente: <span className="text-slate-700 font-medium">{clientName}</span>
        </p>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>CBM facturado</span>
            <span className="font-medium text-slate-800">{Number(totals.billedCbm || 0).toFixed(4)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Envío</span>
            <span className="font-medium text-slate-800">{money(totals.shipping)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Seguro</span>
            <span className="font-medium text-slate-800">{money(totals.insurance)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Consolidación ({totals.packages} paq.)</span>
            <span className="font-medium text-slate-800">{money(totals.consolidation)}</span>
          </div>
          {Number(totals.doorToDoor || 0) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Puerta a puerta</span>
              <span className="font-medium text-slate-800">{money(totals.doorToDoor)}</span>
            </div>
          )}
          {Number(totals.extra || 0) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>{totals.extraConcept || 'Monto adicional'}</span>
              <span className="font-medium text-slate-800">{money(totals.extra)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-slate-800">
            <span>Total</span>
            <span>{money(totals.total)}</span>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-xs uppercase tracking-wide text-slate-400">Ajustes (opcional)</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-500">CBM facturado</Label>
              <Input
                inputMode="decimal"
                value={overrides.billedCbm}
                onChange={(e) => setOverride('billedCbm', e.target.value)}
                placeholder="Automático"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-500">Seguro</Label>
              <Input
                inputMode="decimal"
                value={overrides.insurance}
                onChange={(e) => setOverride('insurance', e.target.value)}
                placeholder={`Auto ${money(totals.autoInsurance)}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-500">Puerta a puerta</Label>
              <Input
                inputMode="decimal"
                value={overrides.doorToDoor}
                onChange={(e) => setOverride('doorToDoor', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-500">Monto adicional</Label>
              <Input
                inputMode="decimal"
                value={overrides.extraAmount}
                onChange={(e) => setOverride('extraAmount', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">Concepto del monto adicional</Label>
            <Input
              value={overrides.extraConcept}
              onChange={(e) => setOverride('extraConcept', e.target.value)}
              placeholder="Ej: manejo especial"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              checked={overrides.consolidationMode === 'manual'}
              onChange={(e) => setOverride('consolidationMode', e.target.checked ? 'manual' : 'auto')}
            />
            Cobrar consolidación manual
          </label>
          {overrides.consolidationMode === 'manual' && (
            <Input
              inputMode="decimal"
              value={overrides.consolidationFee}
              onChange={(e) => setOverride('consolidationFee', e.target.value)}
              placeholder="Monto de consolidación"
            />
          )}
        </div>

        <Button onClick={onCreate} disabled={creating || !canCreate} className="w-full">
          {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
          Generar y enviar factura
        </Button>
        <p className="text-[11px] text-slate-400">
          El cliente recibe el aviso en la app y por email para continuar con el pago de sus envíos disponibles.
        </p>
      </CardContent>
    </Card>
  );
}