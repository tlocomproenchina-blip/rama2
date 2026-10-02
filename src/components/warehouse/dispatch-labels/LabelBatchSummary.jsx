import React from 'react';
import { Button } from '@/components/ui/button';
import { Bluetooth, BluetoothConnected, Loader2, Printer, Tag } from 'lucide-react';
import { bluetoothSupported, isPrinterConnected } from '@/lib/thermalPrinter';

// Cierre del lote: cuántas etiquetas van a salir, estado de la impresora y el botón que
// imprime el lote y con él crea la guía de despacho.
export default function LabelBatchSummary({ count, packages, cbm, printing, progress, statusText, onPrint }) {
  const supported = bluetoothSupported();
  const connected = isPrinterConnected();
  const total = Number(progress?.total) || count;

  return (
    <div className="space-y-2 rounded-2xl border border-border/80 bg-card/85 p-3 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-foreground">
          {count} etiqueta(s) · {packages} paquete(s) · {Number(cbm || 0).toFixed(3)} CBM
        </span>
        <span className={`flex items-center gap-1.5 ${supported ? 'text-muted-foreground' : 'text-destructive'}`}>
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

      <Button className="w-full gap-2" onClick={onPrint} disabled={printing || count <= 0 || !supported}>
        {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        {printing ? 'Imprimiendo…' : `Imprimir lote y crear guía (${count})`}
      </Button>

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <Tag className="mt-0.5 h-3 w-3 shrink-0" />
        La guía de despacho se crea al confirmarse la impresión, solo con las cajas de este lote.
      </p>
    </div>
  );
}