import React from 'react';
import { ReceiptText } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// Pregunta del pago de factura: ¿solicitar factura fiscal? No altera el pago.
export default function FiscalInvoiceChoice({ value, onChange }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-accent/40 p-4">
      <Label className="flex items-center gap-2 font-medium text-slate-700">
        <ReceiptText className="h-4 w-4 text-primary" /> ¿Deseas solicitar una factura fiscal?
      </Label>
      <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-2 gap-3">
        {[{ v: 'no', l: 'NO' }, { v: 'si', l: 'SÍ' }].map((o) => (
          <div key={o.v} className={`flex items-center space-x-2 rounded-xl border p-3 ${value === o.v ? 'border-primary bg-white' : 'border-slate-200'}`}>
            <RadioGroupItem value={o.v} id={`fiscal-${o.v}`} />
            <Label htmlFor={`fiscal-${o.v}`} className="cursor-pointer text-sm font-semibold">{o.l}</Label>
          </div>
        ))}
      </RadioGroup>
      {value === 'si' ? (
        <p className="text-xs text-slate-600">Primero completa este pago. Al cargar tu comprobante te llevaremos a la solicitud de factura fiscal.</p>
      ) : null}
    </div>
  );
}