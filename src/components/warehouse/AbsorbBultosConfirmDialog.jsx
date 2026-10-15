import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRightLeft, Loader2 } from 'lucide-react';

// Señales de uso del bulto viejo (impreso, guía de despacho, factura): se avisan en
// ámbar para que el almacén sepa qué se mueve antes de absorberlo.
function SourceUsage({ source }) {
  const note = source.usage_note || [
    source.printed ? 'su etiqueta ya fue impresa' : null,
    source.dispatched ? 'está despachado' : null,
    source.guide_numbers?.length
      ? `está en la guía de despacho ${source.guide_numbers.join(', ')}`
      : null,
    source.invoice_number
      ? `tiene factura ${source.invoice_number}${source.invoice_status ? ` (${source.invoice_status})` : ''}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (!note) return null;
  return (
    <p className="flex items-start gap-1 text-xs">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{note}</span>
    </p>
  );
}

// Confirmación antes de absorber: muestra el bulto viejo que se va a fusionar y
// eliminar, con su contenido y las señales de uso (impreso, guía, factura) para que
// el almacén acepte con conocimiento de lo que se mueve.
export default function AbsorbBultosConfirmDialog({
  open, sources = [], codes = [], clientEmail = '', busy = false, onConfirm, onCancel,
}) {
  const list = (sources || []).filter(Boolean);
  if (!list.length) return null;

  // Un bulto de otro cliente se conserva: solo se le quita el paquete escaneado.
  const isForeign = (source) =>
    !!clientEmail && !!source?.client_email &&
    String(source.client_email).trim().toLowerCase() !== String(clientEmail).trim().toLowerCase();

  return (
    <Dialog open={!!open} onOpenChange={(o) => !o && onCancel?.()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="h-5 w-5 text-primary" /> Fusionar el bulto anterior
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {codes.length > 1 ? 'Los códigos escaneados ya están' : 'El código escaneado ya está'} dentro de
            {' '}{list.length > 1 ? 'estos bultos' : 'este bulto'}. Al fusionar, todo su contenido pasa al bulto escaneado,
            que es el que prevalece, y {list.length > 1 ? 'los bultos anteriores se eliminan' : 'el bulto anterior se elimina'},
            para no repetir el trabajo.
          </p>

          {list.some(isForeign) && (
            <p className="text-sm text-slate-600">
              Los bultos de otro cliente se dejan registrados y solo se les quita el paquete escaneado.
            </p>
          )}

          {codes.length > 0 && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs text-slate-700 break-all">
              {codes.join(', ')}
            </div>
          )}

          {list.map((source) => (
            <div
              key={source.id || source.label_code}
              className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold break-all">
                  {source.label_code || 'bulto sin etiqueta'}
                </span>
                <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-800">
                  {source.package_count || 0} paquete(s)
                </Badge>
                {source.status && (
                  <Badge variant="outline" className="border-amber-300 text-[10px] capitalize text-amber-800">
                    {String(source.status).replace(/_/g, ' ')}
                  </Badge>
                )}
                {isForeign(source) && (
                  <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-800">
                    otro cliente · se deja sin el paquete
                  </Badge>
                )}
              </div>
              <p className="text-xs">
                N° de contenedor:{' '}
                <span className="font-mono">
                  {source.order_numbers?.length ? source.order_numbers.join(', ') : 'sin asignar'}
                </span>
              </p>
              <SourceUsage source={source} />
            </div>
          ))}

          <p className="text-xs text-slate-500">
            Se mueven sus paquetes, sus códigos sin registrar y su N° de contenedor. Las etiquetas de los demás bultos no cambian.
          </p>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={busy} className="bg-blue-600 hover:bg-blue-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Fusionar y continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}