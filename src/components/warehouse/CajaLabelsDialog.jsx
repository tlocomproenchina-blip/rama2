import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bluetooth, BluetoothConnected, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { buildContinuousLabelPayload, concatUint8Arrays } from '@/lib/tspl';
import {
  bluetoothSupported,
  ensurePrinterConnected,
  isPrinterConnected,
  writePayload,
} from '@/lib/thermalPrinter';
import { localCajasOfClient, saveLocalCaja } from '@/lib/cajaLocal';
import ContinuousLabelPreview from './dispatch-guides/ContinuousLabelPreview';

// Etiquetas continuas del lote de un cliente: una tira numerada 1/N, 2/N… con los datos
// del cliente y, en cada etiqueta, el código de barras de su caja. Esa es la etiqueta que
// se pega en la caja y la que se escanea al despachar para dar la salida definitiva.
//
// La numeración la fija el servidor (assignCajaLabels) para que el X/N impreso coincida
// con el de la guía. Si no hay conexión, se numera en el dispositivo y se imprime igual.
export default function CajaLabelsDialog({ open, onOpenChange, clientEmail, onPrinted }) {
  const [client, setClient] = useState({});
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | connecting | printing | connected | error
  const [written, setWritten] = useState(0);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!clientEmail) return;
    setLoading(true);
    setError('');
    setOffline(false);
    try {
      const res = await base44.functions.invoke('assignCajaLabels', { client_email: clientEmail });
      const data = res?.data || res || {};
      if (!Array.isArray(data.cajas) || !data.cajas.length) throw new Error(data.error || 'Sin cajas');
      setClient(data.client || {});
      setCajas(data.cajas);
    } catch (_) {
      // Sin conexión: se numera con las cajas que ya están en el dispositivo.
      const local = await localCajasOfClient(clientEmail).catch(() => []);
      if (!local.length) {
        setCajas([]);
        setError('No hay cajas pendientes de etiqueta para este cliente.');
      } else {
        const total = local.length;
        setOffline(true);
        setClient(local.find((c) => c.client_snapshot?.full_name)?.client_snapshot || {});
        setCajas(
          local.map((caja, index) => ({
            id: caja.id,
            label_code: caja.label_code,
            caja_number: index + 1,
            caja_total: total,
            package_count:
              (caja.package_ids || []).length + (caja.unregistered_codes || []).length,
            cbm: Number(caja.cargo_cbm) || 0,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [clientEmail]);

  useEffect(() => {
    if (!open) return;
    setWritten(0);
    setStatus(isPrinterConnected() ? 'connected' : 'idle');
    load();
  }, [open, load]);

  const handlePrint = async () => {
    if (!cajas.length) return;
    if (!bluetoothSupported()) {
      toast.error('La impresión Bluetooth solo funciona en Android (Chrome/WebView)');
      return;
    }
    setError('');
    setWritten(0);

    const payloads = cajas.map((caja) =>
      buildContinuousLabelPayload({
        client,
        index: caja.caja_number,
        total: caja.caja_total,
        barcodeCode: caja.label_code,
      })
    );
    const boundaries = [];
    let accumulated = 0;
    payloads.forEach((payload) => {
      accumulated += payload.length;
      boundaries.push(accumulated);
    });

    try {
      setStatus(isPrinterConnected() ? 'printing' : 'connecting');
      await ensurePrinterConnected();
      setStatus('printing');
      await writePayload(concatUint8Arrays(payloads), (bytes) => {
        let done = 0;
        while (done < boundaries.length && boundaries[done] <= bytes) done += 1;
        setWritten(done);
      });
      setWritten(cajas.length);
      setStatus('connected');
      // Las cajas del dispositivo quedan con su posición ya asignada.
      const local = await localCajasOfClient(clientEmail).catch(() => []);
      for (const caja of cajas) {
        const match = local.find((c) => c.label_code === caja.label_code);
        if (match) {
          await saveLocalCaja({
            ...match,
            caja_number: caja.caja_number,
            caja_total: caja.caja_total,
            caja_label_printed_date: new Date().toISOString(),
          }).catch(() => {});
        }
      }
      toast.success(`${cajas.length} etiqueta(s) enviadas a la impresora`);
      onPrinted?.();
    } catch (e) {
      setStatus('error');
      setError(e?.message || 'No se pudo imprimir');
      toast.error(`No se pudo imprimir: ${e?.message || 'error Bluetooth'}`);
    }
  };

  const busy = status === 'connecting' || status === 'printing';
  const first = cajas[0] || null;

  const statusText = () => {
    if (status === 'connecting') return 'Conectando impresora…';
    if (status === 'printing') return `Imprimiendo etiqueta ${Math.min(written + 1, cajas.length)} de ${cajas.length}`;
    if (status === 'connected') return 'Impresora conectada';
    if (status === 'error') return error;
    return 'La impresora se conecta al pulsar Imprimir';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Etiquetas continuas del lote</DialogTitle>
          <DialogDescription>
            Una etiqueta por caja, numerada X/N, con el código QR de la caja. Es la
            etiqueta que se pega en la caja y la que se escanea al despachar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !cajas.length ? (
          <p className="rounded-xl border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
            {error || 'Este cliente no tiene cajas pendientes de etiqueta.'}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/40 text-primary">
                {cajas.length} caja(s)
              </Badge>
              {offline && (
                <Badge variant="outline" className="border-amber-300 text-amber-700">
                  numeración sin conexión
                </Badge>
              )}
            </div>

            <ContinuousLabelPreview
              client={client}
              rangeStart={first.caja_number}
              rangeEnd={first.caja_total}
              barcodeCode={first.label_code}
            />

            <div className="space-y-1.5">
              {cajas.map((caja) => (
                <div
                  key={caja.id || caja.label_code}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-2"
                >
                  <span className="font-mono text-xs text-foreground break-all">{caja.label_code}</span>
                  <span className="shrink-0 text-xs font-semibold text-primary">
                    {caja.caja_number}/{caja.caja_total}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p
                className={`flex items-center gap-2 text-xs ${
                  status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : status === 'connected' ? (
                  <BluetoothConnected className="h-3.5 w-3.5 shrink-0 text-green-600" />
                ) : (
                  <Bluetooth className="h-3.5 w-3.5 shrink-0" />
                )}
                {statusText()}
              </p>

              <Button className="w-full gap-2" onClick={handlePrint} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                {busy
                  ? 'Imprimiendo…'
                  : status === 'error'
                    ? 'Reintentar impresión'
                    : `Imprimir ${cajas.length} etiqueta(s)`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}