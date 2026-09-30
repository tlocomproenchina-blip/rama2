import React from 'react';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, Loader2, RefreshCw, FileDown, AlertTriangle, CloudOff, Hash, Printer,
} from 'lucide-react';
import BluetoothPrinter from '@/components/warehouse/BluetoothPrinter';

// Resultado de la creación de bultos en lote: estado de registro de cada etiqueta
// (registrada, pendiente de sincronizar o no registrada por código repetido) y las
// acciones de impresión disponibles.
const STATUS_META = {
  registrado: { label: 'Registrado en el sistema', tone: 'text-green-700', dot: 'bg-green-500' },
  pendiente: { label: 'Pendiente de sincronizar', tone: 'text-amber-700', dot: 'bg-amber-400' },
  error: { label: 'No se pudo sincronizar', tone: 'text-red-700', dot: 'bg-red-500' },
  duplicado: { label: 'No registrado: ese código ya existía en el sistema', tone: 'text-red-700', dot: 'bg-red-500' },
};

export default function BulkBultoResultPanel({
  createdBultos = [],
  statusById = {},
  summary = { registrados: 0, pendientes: 0, duplicados: 0 },
  orderNumbers = [],
  shippingMark = '',
  replacingId = '',
  printing = false,
  onReplaceDuplicate,
  onDownloadPdf,
  onReset,
  retrySync,
}) {
  if (!createdBultos.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <p className="font-medium text-sm text-slate-800">
          {createdBultos.length} bulto{createdBultos.length !== 1 ? 's' : ''} creado{createdBultos.length !== 1 ? 's' : ''}
          {shippingMark ? ` — ${shippingMark}` : ''}
        </p>
      </div>

      <p className="text-xs text-slate-600">
        {summary.registrados} registrado(s) en el sistema
        {summary.pendientes > 0 && ` · ${summary.pendientes} pendiente(s) de sincronizar`}
        {summary.duplicados > 0 && ` · ${summary.duplicados} no registrado(s)`}
      </p>

      {orderNumbers.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-blue-700">
          <Hash className="h-3 w-3" /> ORDEN {orderNumbers.join(', ')} en todas las etiquetas
        </p>
      )}

      <ul className="space-y-1.5">
        {createdBultos.map((b) => {
          const status = statusById[b.id] || 'pendiente';
          const meta = STATUS_META[status] || STATUS_META.pendiente;
          return (
            <li key={b.id} className="flex items-start gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-slate-700 break-all">{b.label_code}</p>
                <p className={`text-[11px] ${meta.tone}`}>{meta.label}</p>
              </div>
              {status === 'duplicado' && onReplaceDuplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 gap-1 text-[11px]"
                  onClick={() => onReplaceDuplicate(b)}
                  disabled={replacingId === b.id}
                >
                  {replacingId === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Etiqueta nueva
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {summary.duplicados > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Esas etiquetas no se registraron porque su número ya estaba usado en el sistema. Genera una etiqueta
            nueva para cada una antes de imprimir.
          </span>
        </div>
      )}

      {summary.pendientes > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
          <CloudOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            Todavía no se han registrado en el sistema. Revisa la conexión y reintenta la sincronización antes de
            imprimir.
          </span>
          {retrySync && (
            <Button variant="outline" size="sm" className="h-7 shrink-0 gap-1 text-[11px]" onClick={() => retrySync()}>
              <RefreshCw className="h-3 w-3" /> Reintentar
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <BluetoothPrinter bultos={createdBultos} onPrinted={() => {}} />
        <Button variant="outline" onClick={onDownloadPdf} disabled={printing}>
          {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          PDF combinado
        </Button>
        <Button variant="ghost" onClick={onReset} className="ml-auto">
          Crear otros
        </Button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Printer className="h-3 w-3" /> Las etiquetas ya están en la cola de impresión y encoladas para sincronizar.
      </p>
    </div>
  );
}