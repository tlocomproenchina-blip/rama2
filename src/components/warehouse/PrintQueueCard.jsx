import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Trash2, X, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import BluetoothPrinter from './BluetoothPrinter';

// Tarjeta de cola de impresión: lista bultos pendientes, imprime todo en una
// sola conexión Bluetooth, y permite quitar individualmente o vaciar la cola.
export default function PrintQueueCard({ queue, onRemove, onClear, onPrintedAll }) {
  const [confirmClear, setConfirmClear] = useState(false);

  const handlePrinted = async () => {
    // Registrar cada impresión (best-effort) y limpiar la cola
    for (const item of queue) {
      try {
        await base44.functions.invoke('registerBultoPrint', { bulto_id: item.id });
      } catch (_) {}
    }
    await onPrintedAll?.(queue.map((q) => q.id));
    toast.success(`${queue.length} etiqueta(s) impresa(s) y registrada(s)`);
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    onClear?.();
  };

  if (!queue.length) return null;

  return (
    <Card className="border-blue-200 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Printer className="h-5 w-5 text-blue-600" />
              <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                {queue.length}
              </span>
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Cola de impresión</p>
              <p className="text-xs text-slate-500">{queue.length} bulto{queue.length !== 1 ? 's' : ''} pendiente{queue.length !== 1 ? 's' : ''} de imprimir</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className={`text-xs ${confirmClear ? 'text-red-600 hover:text-red-700' : 'text-slate-500'}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmClear ? '¿Confirmar?' : 'Vaciar'}
          </Button>
        </div>

        {/* Lista de bultos pendientes */}
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {queue.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded-md bg-slate-50 border border-slate-100 px-2.5 py-1.5">
              <Printer className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono text-slate-700 truncate">{item.label_code}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {item.client_name || item.client_email} · {item.package_count} paq.
                </p>
              </div>
              <button
                onClick={() => onRemove(item.id)}
                className="shrink-0 text-slate-400 hover:text-red-500 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>

        {/* Impresora: imprime todo el lote en una sola conexión Bluetooth */}
        <BluetoothPrinter bultos={queue.map((q) => q.bulto_snapshot)} onPrinted={handlePrinted} />

        <p className="text-xs text-center text-slate-500 flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
          Acércate a la impresora antes de imprimir. Se imprimirán las {queue.length} etiquetas en una sola conexión.
        </p>
      </CardContent>
    </Card>
  );
}