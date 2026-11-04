import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, BluetoothConnected, Bluetooth, FileDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { buildBultoLabelPayload, concatUint8Arrays } from '@/lib/tspl';
import { downloadBultoLabelsPdf } from '@/lib/bultoLabelPdf';
import { connectAuthorizedPrinter, pickAndConnectPrinter } from '@/lib/bluetoothReconnect';

const friendlyError = (e) => {
  const msg = String(e?.message || '');
  if (/no longer in range|out of range|gesture|NetworkError|GATT/i.test(msg) || e?.name === 'SecurityError') {
    return 'El teléfono no logró enlazar la impresora. Toca "Buscar impresora" y elígela de la lista.';
  }
  if (e?.name === 'NotFoundError') return 'No se eligió ninguna impresora.';
  return msg || 'Error al imprimir';
};

const CHUNK_SIZE = 180; // safe BLE write chunk
const LABEL_COPIES = 3; // cada etiqueta de bulto sale por triplicado
const INTER_CHUNK_DELAY_MS = 80; // delay entre chunks para evitar desbordamiento del buffer

export default function BluetoothPrinter({ bultos = [], onPrinted, autoPrint = false, size = 'default', className = '' }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | printing | error
  const [error, setError] = useState('');
  const deviceRef = useRef(null);
  const serverRef = useRef(null);
  const characteristicRef = useRef(null);

  const btSupported = typeof navigator !== 'undefined' && !!navigator.bluetooth;

  const applySession = (session) => {
    deviceRef.current = session.device;
    serverRef.current = session.server;
    characteristicRef.current = session.characteristic;
    setStatus('connected');
  };

  // Se llama directo desde el toque del botón para que Chrome abra el selector.
  const handleRepair = async () => {
    setError('');
    setStatus('connecting');
    try {
      applySession(await pickAndConnectPrinter());
    } catch (e) {
      setStatus('error');
      setError(friendlyError(e));
      return;
    }
    handlePrint(false);
  };

  const writeData = async (data) => {
    const char = characteristicRef.current;
    if (!char) throw new Error('Impresora no conectada');
    const canWriteWithResponse = !!char.properties.write;
    const canWriteWithoutResponse = !!char.properties.writeWithoutResponse;
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      // Verificar conexión GATT antes de cada chunk
      if (!deviceRef.current?.gatt?.connected) {
        throw new Error('Conexión Bluetooth perdida durante la impresión');
      }
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      try {
        // Priorizar writeValue (con ACK) sobre writeValueWithoutResponse
        if (canWriteWithResponse) {
          await char.writeValue(chunk);
        } else if (canWriteWithoutResponse) {
          await char.writeValueWithoutResponse(chunk);
        } else {
          throw new Error('La característica no soporta escritura');
        }
      } catch (e) {
        // Reintentar una vez con el método alternativo si falla
        if (canWriteWithoutResponse && canWriteWithResponse) {
          try {
            await char.writeValueWithoutResponse(chunk);
          } catch (e2) {
            throw e2;
          }
        } else {
          throw e;
        }
      }
      // Delay entre chunks para evitar desbordamiento del buffer
      await new Promise((r) => setTimeout(r, INTER_CHUNK_DELAY_MS));
    }
  };

  // auto = true: impresión automática al llegar etiquetas nuevas. Solo usa la
  // impresora ya autorizada (sin diálogo); si no está disponible, queda el botón.
  const handlePrint = async (auto = false) => {
    if (!bultos.length) {
      if (!auto) toast.error('No hay bultos para imprimir');
      return;
    }
    try {
      // Connect if needed
      if (!characteristicRef.current || !deviceRef.current?.gatt?.connected) {
        setError('');
        setStatus('connecting');
        let session = await connectAuthorizedPrinter();
        if (!session) {
          if (auto) { setStatus('idle'); return; }
          session = await pickAndConnectPrinter();
        }
        applySession(session);
      }
      setStatus('printing');

      // Build combined payload for all bultos (single Bluetooth session)
      // Cada etiqueta sale con su código QR
      const payloads = bultos.map((b) => buildBultoLabelPayload(b, LABEL_COPIES));
      const combined = concatUint8Arrays(payloads);
      await writeData(combined);

      setStatus('connected');
      const label = bultos.length === 1
        ? `Bulto ${bultos[0].bulto_number}/${bultos[0].total_bultos} impreso`
        : `${bultos.length} bultos impresos`;
      toast.success(label);
      onPrinted?.();
    } catch (e) {
      characteristicRef.current = null;
      setStatus('error');
      setError(friendlyError(e));
      toast.error(`No se pudo imprimir: ${friendlyError(e)}`);
    }
  };

  const downloadPdf = async () => {
    if (!bultos.length) return;
    try {
      await downloadBultoLabelsPdf(bultos);
      toast.success(`${bultos.length} etiqueta(s) PDF descargada(s)`);
      onPrinted?.();
    } catch (e) {
      toast.error(`Error generando PDF: ${e?.message || ''}`);
    }
  };

  const isBusy = status === 'connecting' || status === 'printing';

  const autoKey = autoPrint ? bultos.map((b) => b?.label_code || b?.id).join('|') : '';
  const lastAutoKeyRef = useRef('');
  useEffect(() => {
    if (!autoKey || !btSupported || isBusy || lastAutoKeyRef.current === autoKey) return;
    lastAutoKeyRef.current = autoKey;
    handlePrint(true);
  }, [autoKey]);
  const label = bultos.length === 1
    ? `Imprimir Bulto ${bultos[0].bulto_number}/${bultos[0].total_bultos}`
    : bultos.length > 1
      ? `Imprimir ${bultos.length} bultos`
      : 'Imprimir';

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => handlePrint(false)} disabled={!bultos.length || isBusy || !btSupported} className="bg-blue-600 hover:bg-blue-700">
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : status === 'connected' ? <BluetoothConnected className="h-4 w-4" /> : <Printer className="h-4 w-4" />}
          {label}
        </Button>
        <Button variant="outline" onClick={downloadPdf} disabled={!bultos.length || isBusy}>
          <FileDown className="h-4 w-4" />
          PDF
        </Button>
      </div>
      {status === 'connected' && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <BluetoothConnected className="h-3 w-3" /> Impresora conectada
        </p>
      )}
      {!btSupported && (
        <p className="text-xs text-amber-600 flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          La impresión Bluetooth solo funciona en Android (Chrome/WebView). Descarga el PDF como alternativa.
        </p>
      )}
      {status === 'error' && error && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-red-600">{error}</p>
          <Button variant="outline" size="sm" onClick={handleRepair} className="self-start">
            <Bluetooth className="h-4 w-4" />
            Buscar impresora
          </Button>
        </div>
      )}
    </div>
  );
}