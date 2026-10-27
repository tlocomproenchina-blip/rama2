import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bluetooth, BluetoothConnected, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { buildContinuousLabelPayload, concatUint8Arrays } from '@/lib/tspl';
import {
  bluetoothSupported,
  ensurePrinterConnected,
  isPrinterConnected,
  writePayload,
} from '@/lib/thermalPrinter';
import ContinuousLabelPreview from './ContinuousLabelPreview';
import LabelCajaAssignList from './LabelCajaAssignList';

// Tope por lote para no saturar el buffer de la impresora; con el campo "Desde" se
// continúa el resto del lote.
const MAX_LABELS = 60;

const clientsOfGuide = (guide) => (Array.isArray(guide?.clients) ? guide.clients : []);

// Datos del cliente tal como quedaron guardados en la guía (snapshot), no del perfil
// actual: es lo que se imprimió en la guía que se está entregando.
const clientDataOf = (client) => {
  const snapshot = client?.client || {};
  return {
    full_name:
      snapshot.full_name ||
      String(client?.client_name || '').replace(/^Sin registrar(?= —|$)/i, 'Cliente') ||
      '',
    cedula: snapshot.cedula || '',
    whatsapp: snapshot.whatsapp || '',
    address: snapshot.address || '',
    city: snapshot.city || '',
    state: snapshot.state || '',
    shipping_mark: snapshot.shipping_mark || client?.shipping_mark || '',
  };
};

// Etiquetas continuas: a partir de una guía emitida se imprime en la impresora
// térmica Bluetooth una tira de etiquetas numeradas 1/N, 2/N… con los datos del
// cliente de esa guía. No crea bultos ni códigos: es una impresión.
export default function ContinuousLabelsDialog({ guide, open, onOpenChange }) {
  const clients = useMemo(() => clientsOfGuide(guide), [guide]);
  const [clientKey, setClientKey] = useState('');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('10');
  const [status, setStatus] = useState('idle'); // idle | connecting | printing | connected | error
  const [written, setWritten] = useState(0);
  const [error, setError] = useState('');
  const [cajas, setCajas] = useState([]);
  const [assign, setAssign] = useState({});

  // Cada vez que se abre el panel se parte del primer cliente de la guía y del rango
  // por defecto, sin arrastrar estados anteriores.
  useEffect(() => {
    if (!open) return;
    setClientKey(clients[0]?.client_key || clients[0]?.client_email || '');
    setFrom('1');
    setTo('10');
    setWritten(0);
    setError('');
    setAssign({});
    setCajas([]);
    setStatus(isPrinterConnected() ? 'connected' : 'idle');
  }, [open, guide?.id, clients]);

  const selectedIndex = Math.max(
    0,
    clients.findIndex((c) => (c.client_key || c.client_email) === clientKey)
  );
  const selected = clients[selectedIndex];
  const clientData = useMemo(() => clientDataOf(selected), [selected]);

  // Cajas con código de barras de ese cliente: las que van dentro de la guía (con su
  // código y su X/N ya guardados) y, si la guía no trae ninguna, las que quedaron
  // pendientes de etiqueta, que numera la función que ya existe.
  const guideCajas = useMemo(() => {
    const list = Array.isArray(selected?.bultos) ? selected.bultos : [];
    return list
      .filter((b) => b?.is_caja && b?.label_code)
      .map((b) => ({
        label_code: b.label_code,
        caja_number: Number(b.caja_number) || 0,
        caja_total: Number(b.caja_total) || 0,
      }));
  }, [selected]);

  useEffect(() => {
    if (!open) return undefined;
    if (guideCajas.length) {
      setCajas(guideCajas);
      return undefined;
    }
    const email = selected?.client_email || '';
    if (!email) {
      setCajas([]);
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('assignCajaLabels', { client_email: email });
        const data = res?.data || res || {};
        if (alive) setCajas(Array.isArray(data.cajas) ? data.cajas : []);
      } catch (_) {
        if (alive) setCajas([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, guideCajas, selected?.client_email]);

  const start = Math.max(1, Number(from) || 1);
  const end = Number(to) || 0;
  const count = end >= start ? end - start + 1 : 0;
  const tooMany = count > MAX_LABELS;
  const busy = status === 'connecting' || status === 'printing';
  const guideNumber = guide?.guide_number || '';
  const labels = useMemo(
    () => (count > 0 ? Array.from({ length: count }, (_, i) => start + i) : []),
    [count, start]
  );
  const cajaOf = (number) => cajas.find((c) => c.label_code === assign[number]) || null;
  const handleAssign = (number, code) => setAssign((prev) => ({ ...prev, [number]: code }));
  const handleAutoAssign = () =>
    setAssign((prev) => {
      const next = { ...prev };
      labels.forEach((number, i) => {
        if (cajas[i]) next[number] = cajas[i].label_code;
      });
      return next;
    });

  const handlePrint = async () => {
    if (!clients.length) {
      toast.error('Esta guía no tiene clientes guardados');
      return;
    }
    if (count <= 0) {
      toast.error('El número final debe ser mayor o igual al número inicial');
      return;
    }
    if (tooMany) {
      toast.error(`Máximo ${MAX_LABELS} etiquetas por lote. Sube el número inicial para el resto.`);
      return;
    }
    if (!bluetoothSupported()) {
      toast.error('La impresión Bluetooth solo funciona en Android (Chrome/WebView)');
      return;
    }

    setError('');
    setWritten(0);

    const payloads = labels.map((number) =>
      buildContinuousLabelPayload({
        client: clientData,
        index: number,
        total: end,
        guideNumber,
        emittedAt: guide?.emitted_date || '',
        barcodeCode: cajaOf(number)?.label_code || '',
      })
    );

    // El lote sale en una sola sesión y en un solo payload: se guardan los límites de
    // bytes de cada etiqueta para informar cuál va saliendo.
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
      setWritten(count);
      setStatus('connected');
      toast.success(`${count} etiqueta(s) enviadas a la impresora`);
    } catch (e) {
      setStatus('error');
      setError(e?.message || 'No se pudo imprimir');
      toast.error(`No se pudo imprimir: ${e?.message || 'error Bluetooth'}`);
    }
  };

  const statusText = () => {
    if (status === 'connecting') return 'Conectando impresora…';
    if (status === 'printing') {
      return `Imprimiendo etiqueta ${Math.min(written + 1, count)} de ${count}`;
    }
    if (status === 'connected') return 'Impresora conectada';
    if (status === 'error') return error;
    return 'La impresora se conecta al pulsar Imprimir';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Etiquetas continuas</DialogTitle>
          <DialogDescription>
            {guideNumber ? `Guía ${guideNumber} · ` : ''}
            Tira continua numerada X/N con los datos del cliente de esa guía. Cada etiqueta puede
            llevar el código de barras de la caja que identifica; no crea bultos ni códigos.
          </DialogDescription>
        </DialogHeader>

        {clients.length > 1 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cliente de la guía</Label>
            <div className="flex flex-wrap gap-1.5">
              {clients.map((client, index) => {
                const key = client.client_key || client.client_email || String(index);
                const active = index === selectedIndex;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setClientKey(key);
                      setAssign({});
                    }}
                    className={`max-w-full truncate rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-primary/40 bg-accent text-accent-foreground'
                        : 'border-border/70 bg-card/70 text-muted-foreground'
                    }`}
                  >
                    {String(client.client_name || client.client_email || 'Cliente').replace(
                      /^Sin registrar(?= —|$)/i,
                      'Cliente'
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <ContinuousLabelPreview
          client={clientData}
          rangeStart={start}
          rangeEnd={end || start}
          guideNumber={guideNumber}
          barcodeCode={cajaOf(start)?.label_code || ''}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="labels-from" className="text-xs text-muted-foreground">
              Desde
            </Label>
            <Input
              id="labels-from"
              type="number"
              inputMode="numeric"
              min="1"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="labels-to" className="text-xs text-muted-foreground">
              Imprimir hasta el número
            </Label>
            <Input
              id="labels-to"
              type="number"
              inputMode="numeric"
              min="1"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {count > 0 ? (
            <>
              <span className="font-semibold text-foreground">{count} etiqueta(s)</span> ·{' '}
              {start}/{end} … {end}/{end}
            </>
          ) : (
            'El número final debe ser mayor o igual al número inicial.'
          )}
          {tooMany && ` · Máximo ${MAX_LABELS} por lote`}
        </p>

        <LabelCajaAssignList
          labels={labels}
          total={end || start}
          cajas={cajas}
          assign={assign}
          onAssign={handleAssign}
          onAutoAssign={handleAutoAssign}
        />

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
            onClick={handlePrint}
            disabled={busy || count <= 0 || tooMany || !clients.length}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {busy
              ? 'Imprimiendo…'
              : status === 'error'
                ? 'Reintentar impresión'
                : `Imprimir ${count > 0 ? count : ''} etiqueta(s)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}