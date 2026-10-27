import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bluetooth, BluetoothConnected, Loader2, Printer, Tag } from 'lucide-react';
import { bluetoothSupported, isPrinterConnected } from '@/lib/thermalPrinter';

// Único dato del lote: cuántas cajas van a salir. Con eso se imprime una etiqueta por
// caja —los datos del cliente y el X/N de esa cantidad— y nace la guía de despacho.
export default function BoxQuantityCard({
  quantity,
  onQuantityChange,
  pendingCount = 0,
  printing,
  progress,
  statusText,
  onPrint,
}) {
  const supported = bluetoothSupported();
  const connected = isPrinterConnected();
  const count = Number(quantity) || 0;
  const total = Number(progress?.total) || count;
  // Sin cajas pendientes la etiqueta sale igual: sin código QR y sin crear guía.
  const withoutBoxes = pendingCount === 0;
  const exceeds = !withoutBoxes && count > pendingCount;

  return (
    <div className="space-y-3 rounded-2xl border border-border/80 bg-card/85 p-4 shadow-card">
      <div className="space-y-1.5">
        <Label htmlFor="box-quantity">Cantidad de cajas a enviar</Label>
        <Input
          id="box-quantity"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => onQuantityChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="0"
          disabled={printing}
          className="h-14 text-center text-3xl font-bold"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{pendingCount} caja(s) pendientes por despachar</span>
        <span
          className={`flex items-center gap-1.5 ${supported ? 'text-muted-foreground' : 'text-destructive'}`}
        >
          {printing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : connected ? (
            <BluetoothConnected className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Bluetooth className="h-3.5 w-3.5" />
          )}
          {printing
            ? statusText || `Imprimiendo etiqueta ${Math.min((progress?.done || 0) + 1, total)} de ${total}`
            : supported
              ? statusText || (connected ? 'Impresora conectada' : 'La impresora se conecta al pulsar Imprimir')
              : 'La impresión Bluetooth solo funciona en Android (Chrome/WebView)'}
        </span>
      </div>

      {exceeds && (
        <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-2 text-[11px] text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          Solo hay {pendingCount} caja(s) pendientes por despachar para este cliente.
        </p>
      )}

      {withoutBoxes && (
        <p className="rounded-xl border border-blue-200 bg-blue-50/70 p-2 text-[11px] text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">
          Este cliente no tiene cajas pendientes por despachar (su carga ya salió en una guía):
          la etiqueta sale igual, sin código QR y sin crear guía.
        </p>
      )}

      <Button
        className="w-full gap-2"
        onClick={onPrint}
        disabled={printing || count <= 0 || exceeds || !supported}
      >
        {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        {printing
          ? 'Imprimiendo…'
          : withoutBoxes
            ? `Imprimir etiqueta (${count})`
            : `Imprimir etiqueta y crear guía (${count})`}
      </Button>

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Tag className="mt-0.5 h-3 w-3 shrink-0" />
        {withoutBoxes
          ? 'Sale una etiqueta por unidad escrita, con los datos del cliente y el X/N de esa cantidad. Sin cajas pendientes no se crea guía; cada impresión queda en el historial.'
          : 'Sale una etiqueta por caja, con los datos del cliente y el X/N de esa cantidad. La guía se crea al confirmarse la impresión y el lote queda en el historial.'}
      </p>
    </div>
  );
}