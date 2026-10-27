import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Bluetooth, BluetoothConnected, FileDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { buildBultoLabelPayload, concatUint8Arrays } from '@/lib/tspl';
import { downloadBultoLabelsPdf } from '@/lib/bultoLabelPdf';
import { resolvePrinterDevice, findWriteCharacteristic, connectAuthorizedPrinter } from '@/lib/bluetoothReconnect';

const CHUNK_SIZE = 180; // safe BLE write chunk
const INTER_CHUNK_DELAY_MS = 80; // delay entre chunks para evitar desbordamiento del buffer

export default function BluetoothPrinter({ bultos = [], onPrinted, size = 'default', className = '' }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | printing | error
  const [error, setError] = useState('');
  const deviceRef = useRef(null);
  const serverRef = useRef(null);
  const characteristicRef = useRef(null);

  const btSupported = typeof navigator !== 'undefined' && !!navigator.bluetooth;

  const connect = async () => {
    if (!btSupported) throw new Error('Bluetooth no soportado en este navegador');
    setStatus('connecting');
    setError('');

    // En standby esto pide el dispositivo como siempre; con la reconexión
    // activada reutiliza la impresora ya autorizada y evita el diálogo.
    const { device } = await resolvePrinterDevice();

    deviceRef.current = device;
    const server = await device.gatt.connect();
    serverRef.current = server;
    const char = await findWriteCharacteristic(server);
    if (!char) {
      throw new Error('No se encontró una característica de escritura en la impresora');
    }
    characteristicRef.current = char;
    setStatus('connected');
    return char;
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

  const handlePrint = async () => {
    if (!bultos.length) {
      toast.error('No hay bultos para imprimir');
      return;
    }
    try {
      // Connect if needed
      if (!characteristicRef.current || !deviceRef.current?.gatt?.connected) {
        const silent = await connectAuthorizedPrinter();
        if (silent) {
          deviceRef.current = silent.device;
          serverRef.current = silent.server;
          characteristicRef.current = silent.characteristic;
          setStatus('connected');
        } else {
          await connect();
        }
      }
      setStatus('printing');

      // Build combined payload for all bultos (single Bluetooth session)
      // Cada etiqueta sale con su código QR
      const payloads = bultos.map((b) => buildBultoLabelPayload(b));
      const combined = concatUint8Arrays(payloads);
      await writeData(combined);

      setStatus('connected');
      const label = bultos.length === 1
        ? `Bulto ${bultos[0].bulto_number}/${bultos[0].total_bultos} impreso`
        : `${bultos.length} bultos impresos`;
      toast.success(label);
      onPrinted?.();
    } catch (e) {
      setStatus('error');
      setError(e?.message || 'Error al imprimir');
      toast.error(`No se pudo imprimir: ${e?.message || 'error Bluetooth'}`);
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
  const label = bultos.length === 1
    ? `Imprimir Bulto ${bultos[0].bulto_number}/${bultos[0].total_bultos}`
    : bultos.length > 1
      ? `Imprimir ${bultos.length} bultos`
      : 'Imprimir';

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap gap-2">
        <Button onClick={handlePrint} disabled={!bultos.length || isBusy || !btSupported} className="bg-blue-600 hover:bg-blue-700">
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
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}