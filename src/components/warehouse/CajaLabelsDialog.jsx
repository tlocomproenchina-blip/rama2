import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bluetooth, BluetoothConnected, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { buildBultoLabelPayload, concatUint8Arrays } from '@/lib/tspl';
import {
  bluetoothSupported,
  ensurePrinterConnected,
  isPrinterConnected,
  writePayload,
} from '@/lib/thermalPrinter';
import { localCajasOfClient, saveLocalCaja } from '@/lib/cajaLocal';
import { bulkPut } from '@/lib/offlineDb';
import ContinuousLabelPreview from './dispatch-guides/ContinuousLabelPreview';

const LABEL_COPIES = 3; // cada etiqueta de caja sale por triplicado, igual que los bultos

// Etiquetas continuas del lote de un cliente: una tira numerada 1/N, 2/N… con los datos
// del cliente y, en cada etiqueta, el código QR de su caja. Esa es la etiqueta que
// se pega en la caja y la que se escanea al despachar para dar la salida definitiva.
//
// La numeración se arma en el dispositivo (incluye la caja recién cerrada aunque todavía
// no llegue al servidor) y se imprime al instante. Con conexión, antes se suman en un
// par de segundos las cajas del cliente registradas desde otros equipos. El X/N impreso
// se entrega luego al servidor (onAssigned) para que la guía use el mismo.
const SERVER_WAIT_MS = 2500;

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

async function lotCajas(clientEmail) {
  if (typeof navigator === 'undefined' || navigator.onLine) {
    const server = await withTimeout(
      base44.entities.Bulto.filter({ client_email: clientEmail, is_caja: true }, '-created_date', 200).catch(() => null),
      SERVER_WAIT_MS
    );
    if (Array.isArray(server) && server.length) {
      const local = await localCajasOfClient(clientEmail).catch(() => []);
      const linked = new Set(local.map((c) => c.server_bulto_id).filter(Boolean));
      await bulkPut('bultos', server.filter((c) => !linked.has(c.id))).catch(() => {});
    }
  }
  // Una caja puede estar dos veces (copia local enlazada + copia del servidor): una por código.
  const seen = new Set();
  return (await localCajasOfClient(clientEmail).catch(() => [])).filter((c) => {
    const key = String(c.label_code || '').toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function CajaLabelsDialog({ open, onOpenChange, clientEmail, onPrinted, onAssigned, autoPrint = false, onAutoPrinted }) {
  const [client, setClient] = useState({});
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | connecting | printing | connected | error
  const [written, setWritten] = useState(0);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!clientEmail) return;
    setLoading(true);
    setError('');
    setOffline(false);
    try {
      const local = await lotCajas(clientEmail);
      if (!local.length) {
        setCajas([]);
        setError('No hay cajas pendientes de etiqueta para este cliente.');
      } else {
        const total = local.length;
        setOffline(typeof navigator !== 'undefined' && !navigator.onLine);
        setClient(local.find((c) => c.client_snapshot?.full_name)?.client_snapshot || {});
        setCajas(
          local.map((caja, index) => ({
            id: caja.id,
            label_code: caja.label_code,
            caja_number: index + 1,
            caja_total: total,
            package_count: Number(caja.cargo_package_count)
              || (caja.package_ids || []).length + (caja.unregistered_codes || []).length,
            cbm: Number(caja.cargo_cbm) || 0,
            order_numbers: caja.cbm_order_numbers || [],
          }))
        );
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [clientEmail]);

  useEffect(() => {
    if (!open) {
      setLoaded(false);
      return;
    }
    setWritten(0);
    setStatus(isPrinterConnected() ? 'connected' : 'idle');
    load();
  }, [open, load]);

  // pick: abre el selector de Chrome (solo desde el toque del botón tras un error).
  const handlePrint = async ({ pick = false } = {}) => {
    if (!cajas.length) return;
    if (!bluetoothSupported()) {
      toast.error('La impresión Bluetooth solo funciona en Android (Chrome/WebView)');
      return;
    }
    setError('');
    setWritten(0);

    // Misma etiqueta que el bulto: QR + código, estado y contenedor, conteo real y datos del cliente.
    const payloads = cajas.map((caja) =>
      buildBultoLabelPayload({
        is_caja: true,
        label_code: caja.label_code,
        client_snapshot: client,
        cbm_order_numbers: caja.order_numbers || [],
        cargo_package_count: caja.package_count,
      }, LABEL_COPIES)
    );
    const boundaries = [];
    let accumulated = 0;
    payloads.forEach((payload) => {
      accumulated += payload.length;
      boundaries.push(accumulated);
    });

    try {
      setStatus(isPrinterConnected() ? 'printing' : 'connecting');
      await ensurePrinterConnected({ pick });
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
      onAssigned?.(cajas);
      onPrinted?.();
    } catch (e) {
      setStatus('error');
      setError(e?.message || 'No se pudo imprimir');
      toast.error(`No se pudo imprimir: ${e?.message || 'error Bluetooth'}`);
    }
  };

  // Impresión automática al terminar de registrarse la caja: una sola vez por apertura.
  useEffect(() => {
    if (!open || !autoPrint || !loaded || loading || !cajas.length) return;
    onAutoPrinted?.();
    handlePrint();
  }, [open, autoPrint, loaded, loading, cajas.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

              <Button
                className="w-full gap-2"
                onClick={() => handlePrint({ pick: status === 'error' })}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                {busy
                  ? 'Imprimiendo…'
                  : status === 'error'
                    ? 'Buscar impresora e imprimir'
                    : `Imprimir ${cajas.length} etiqueta(s) × ${LABEL_COPIES}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}