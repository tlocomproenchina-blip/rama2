import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';

function TotalRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

// Resumen del lote antes de emitir: cuántos clientes van, cuánto se factura y el
// botón que emite la factura y la manda al correo del mayorista.
export default function WholesalerBillingSummary({ totals, invoiceEmail, notes, onNotesChange, onEmit, emitting }) {
  return (
    <Card className="rounded-2xl border-0 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">Resumen de la factura</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <TotalRow label="Clientes incluidos" value={totals.clients} />
          <TotalRow label="Órdenes / envíos" value={totals.orders} />
          <TotalRow label="Bultos facturables" value={totals.bultos} />
          <TotalRow label="Trackings recibidos" value={totals.received} />
          <TotalRow label="Servicio de envío (por CBM)" value={`$${totals.shipping.toFixed(2)}`} />
          <TotalRow label="CBM facturable" value={totals.cbm.toFixed(4).replace(/\.?0+$/, '') || '0'} />
          <TotalRow label="Servicio puerta a puerta" value={`$${totals.doorToDoor.toFixed(2)}`} />
          <TotalRow label="Manejo de paquetes" value={`$${totals.handling.toFixed(2)}`} />
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <span className="text-sm font-semibold text-foreground">Total de la factura</span>
          <span className="font-display text-xl font-semibold text-foreground">${totals.total.toFixed(2)}</span>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Nota para el lote (opcional)</label>
          <textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            rows={2}
            className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            placeholder="Ej: carga consolidada de octubre"
          />
        </div>

        <Button className="w-full gap-2" onClick={onEmit} disabled={emitting || !totals.clients}>
          {emitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {emitting ? 'Emitiendo y enviando…' : 'Emitir factura y enviar al mayorista'}
        </Button>
        <p className={`text-xs ${invoiceEmail ? 'text-muted-foreground' : 'text-amber-600'}`}>
          {invoiceEmail
            ? `La factura de todos los clientes se envía solo al correo del mayorista (${invoiceEmail}).`
            : 'Este mayorista todavía no tiene correo de facturación: agrégalo en su conexión para que le llegue la factura.'}
        </p>
      </CardContent>
    </Card>
  );
}