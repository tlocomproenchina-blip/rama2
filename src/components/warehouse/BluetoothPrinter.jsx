import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Bluetooth, BluetoothConnected, FileDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { buildBultoLabelPayload, concatUint8Arrays } from '@/lib/tspl';

// Common BLE service/characteristic UUIDs for ESC/POS thermal printers (POS-9250-L / ZJ-9250)
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae4-9fa8-5b5fef8f6bd7',
];
const WRITE_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
];

const CHUNK_SIZE = 180; // safe BLE write chunk
const INTER_CHUNK_DELAY_MS = 80; // delay entre chunks para evitar desbordamiento del buffer

export default function BluetoothPrinter({ bultos = [], onPrinted, size = 'default', className = '' }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | printing | error
  const [error, setError] = useState('');
  const deviceRef = useRef(null);
  const serverRef = useRef(null);
  const characteristicRef = useRef(null);

  const btSupported = typeof navigator !== 'undefined' && !!navigator.bluetooth;

  const findWriteCharacteristic = async (server) => {
    for (const serviceUuid of PRINTER_SERVICES) {
      let service;
      try {
        service = await server.getPrimaryService(serviceUuid);
      } catch (_) {
        continue;
      }
      for (const charUuid of WRITE_CHARACTERISTICS) {
        try {
          const char = await service.getCharacteristic(charUuid);
          if (char && (char.properties.write || char.properties.writeWithoutResponse)) {
            return char;
          }
        } catch (_) {}
      }
      // Fallback: first writable characteristic in the service
      try {
        const chars = await service.getCharacteristics();
        const writable = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
        if (writable) return writable;
      } catch (_) {}
    }
    return null;
  };

  const connect = async () => {
    if (!btSupported) throw new Error('Bluetooth no soportado en este navegador');
    setStatus('connecting');
    setError('');

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [PRINTER_SERVICES[0]] }, { services: [PRINTER_SERVICES[1]] }, { namePrefix: 'POS' }, { namePrefix: 'ZJ' }, { namePrefix: 'Printer' }],
      optionalServices: PRINTER_SERVICES,
    });

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
        await connect();
      }
      setStatus('printing');

      // Build combined payload for all bultos (single Bluetooth session)
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
      const { default: jsPDF } = await import('jspdf');
      const JsBarcode = (await import('jsbarcode')).default;

      for (const bulto of bultos) {
        const doc = new jsPDF({ unit: 'mm', format: [100, 100] });
        const cs = bulto.client_snapshot || {};
        const pkgCount = bulto.package_ids?.length || bulto.package_trackings?.length || 0;
        let y = 5;

        // 1. Barcode (top, centered, bigger) with label code
        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, bulto.label_code, { format: 'CODE128', width: 4, height: 80, displayValue: true, fontSize: 18, margin: 0 });
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 85;
          const imgHeight = (canvas.height / canvas.width) * imgWidth;
          doc.addImage(imgData, 'PNG', (100 - imgWidth) / 2, y, imgWidth, imgHeight);
          y += imgHeight + 3;
        } catch (_) {}

        // Separator line
        doc.setLineWidth(0.3);
        doc.line(5, y, 95, y);
        y += 4;

        // 2. Estado (very large, centered, bold) — priority for sorting
        doc.setFontSize(28);
        doc.setTextColor(0);
        doc.setFont(undefined, 'bold');
        doc.text((cs.state || 'SIN ESTADO').toUpperCase(), 50, y + 5, { align: 'center' });
        y += 12;

        // Separator line
        doc.setLineWidth(0.3);
        doc.line(5, y, 95, y);
        y += 5;

        // 3. Bulto number + package count in one line (centered, large)
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text(`BULTO ${bulto.bulto_number}/${bulto.total_bultos} - ${pkgCount} PAQUETES`, 50, y, { align: 'center' });
        y += 7;

        // Separator line
        doc.setLineWidth(0.3);
        doc.line(5, y, 95, y);
        y += 5;

        // 4. Client data — name + cédula in one line
        doc.setFontSize(13);
        const nameCedula = [cs.full_name, cs.cedula ? `C.I. ${cs.cedula}` : ''].filter(Boolean).join(' - ');
        if (nameCedula) { doc.text(nameCedula, 5, y); y += 6; }
        doc.setFontSize(11);
        if (cs.whatsapp) { doc.text(`Tel: ${cs.whatsapp}`, 5, y); y += 5; }
        doc.setFontSize(10);
        if (cs.address) {
          const addrLines = doc.splitTextToSize(cs.address, 90);
          doc.text(addrLines.slice(0, 2), 5, y);
          y += addrLines.slice(0, 2).length * 4.5;
        }
        const cityState = [cs.city, cs.state].filter(Boolean).join(', ');
        if (cityState) { doc.text(cityState, 5, y); }

        doc.save(`etiqueta-${bulto.label_code}.pdf`);
      }
      toast.success(`${bultos.length} etiqueta(s) PDF descargada(s)`);
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