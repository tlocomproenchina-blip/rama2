import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, Bluetooth, BluetoothConnected, FileDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { buildBultoLabelPayload, concatUint8Arrays } from '@/lib/tspl';
import { labelContentCodes, realPackageCount } from '@/lib/bultoCounts';

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
        // Mismo conteo real que la ficha del almacén y que la impresión térmica.
        const pkgCount = realPackageCount(bulto);
        const trackings = labelContentCodes(bulto);
        const estado = (cs.state || 'SIN ESTADO').toUpperCase();
        const nameCedula = [cs.full_name, cs.cedula ? `C.I. ${cs.cedula}` : ''].filter(Boolean).join(' - ');
        const cityState = [cs.city, cs.state].filter(Boolean).join(', ');
        const addrLines = cs.address ? doc.splitTextToSize(cs.address, 90).slice(0, 2) : [];

        // Código de barras como imagen (centrado, ancho)
        let barcode = null;
        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, bulto.label_code, { format: 'CODE128', width: 4, height: 80, displayValue: true, fontSize: 18, margin: 0 });
          barcode = { data: canvas.toDataURL('image/png'), ratio: canvas.height / canvas.width };
        } catch (_) {}

        // Métricas verticales (mm). Cada bloque conoce su alto y se dibuja centrado.
        const MARGIN = 5;
        const PRINTABLE_H = 90; // 100 mm menos márgenes
        const CONTENT_LINE_H = 3;
        const CONTENT_TITLE_H = 7; // separador + título CONTENIDO
        const sep = (yy) => { doc.setLineWidth(0.3); doc.line(5, yy, 95, yy); };

        const blocks = [];
        const addBlock = (h, render) => blocks.push({ h, render });

        // 1. Código de barras + código de etiqueta (la imagen ya lo incluye)
        if (barcode) {
          const imgWidth = 85;
          const imgHeight = barcode.ratio * imgWidth;
          addBlock(imgHeight + 2, (yy) => doc.addImage(barcode.data, 'PNG', (100 - imgWidth) / 2, yy, imgWidth, imgHeight));
        }

        // 2. Separador
        addBlock(4, (yy) => sep(yy + 2));

        // 3. Estado + N° de orden: misma línea y mismo tamaño, con el rótulo
        //    "ORDEN" en pequeño encima del número.
        const ordenStr = (Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers.filter(Boolean) : []).join(', ');
        addBlock(ordenStr ? 15 : 12, (yy) => {
          doc.setTextColor(0);
          doc.setFont(undefined, 'bold');
          let size = 28;
          doc.setFontSize(size);
          const gap = 6;
          const maxW = 88;
          const rawW = doc.getTextWidth(estado) + (ordenStr ? gap + doc.getTextWidth(ordenStr) : 0);
          if (ordenStr && rawW > maxW) {
            // Ambos textos comparten tamaño: se reduce solo lo necesario para que entren.
            size = Math.max(9, Math.floor(size * maxW / rawW));
            doc.setFontSize(size);
          }
          const wE = doc.getTextWidth(estado);
          const wO = ordenStr ? doc.getTextWidth(ordenStr) : 0;
          const totalW = wE + (ordenStr ? gap + wO : 0);
          const x0 = Math.max(5, (100 - totalW) / 2);
          if (ordenStr) {
            const baseY = yy + 13;
            doc.text(estado, x0, baseY);
            doc.text(ordenStr, x0 + wE + gap, baseY);
            doc.setFontSize(7);
            doc.text('ORDEN', x0 + wE + gap + wO / 2, yy + 3.5, { align: 'center' });
          } else {
            doc.text(estado, 50, yy + 11, { align: 'center' });
          }
        });

        // 4. Separador
        addBlock(4, (yy) => sep(yy + 2));

        // 5. Bulto X/Y + cantidad de paquetes
        addBlock(8.5, (yy) => {
          doc.setFontSize(18);
          doc.setFont(undefined, 'bold');
          doc.text(`BULTO ${bulto.bulto_number}/${bulto.total_bultos} - ${pkgCount} PAQUETES`, 50, yy + 7, { align: 'center' });
        });

        // 6. Separador
        addBlock(4, (yy) => sep(yy + 2));

        // 7. Datos del cliente
        if (nameCedula) addBlock(6.5, (yy) => {
          doc.setFontSize(13);
          doc.setFont(undefined, 'bold');
          doc.text(nameCedula, 5, yy + 5);
        });
        if (cs.whatsapp) addBlock(5.5, (yy) => {
          doc.setFontSize(11);
          doc.setFont(undefined, 'bold');
          doc.text(`Tel: ${cs.whatsapp}`, 5, yy + 4.5);
        });
        if (addrLines.length) addBlock(addrLines.length * 4.5, (yy) => {
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          addrLines.forEach((ln, i) => doc.text(ln, 5, yy + 4 + i * 4.5));
        });
        if (cityState) addBlock(5.5, (yy) => {
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.text(cityState, 5, yy + 4.5);
        });

        const fixedH = blocks.reduce((sum, b) => sum + b.h, 0);

        // 8. Trackings contenidos: usan el espacio que sobra tras centrar el resto.
        //    Si no caben todos, la última línea resume cuántos faltan ("+N más").
        const hasContent = trackings.length > 0 && PRINTABLE_H - fixedH >= CONTENT_TITLE_H + CONTENT_LINE_H;
        const maxLines = hasContent ? Math.max(1, Math.floor((PRINTABLE_H - fixedH - CONTENT_TITLE_H) / CONTENT_LINE_H)) : 0;
        const drawnLines = hasContent ? Math.min(trackings.length, maxLines) : 0;
        const truncated = hasContent && trackings.length > drawnLines;
        const shown = truncated ? drawnLines - 1 : drawnLines;

        // Centrado vertical: márgenes parejos arriba y abajo
        const contentH = hasContent ? CONTENT_TITLE_H : 0;
        const totalH = fixedH + contentH + drawnLines * CONTENT_LINE_H;
        let y = MARGIN + Math.max(0, (PRINTABLE_H - totalH) / 2);

        for (const b of blocks) { b.render(y); y += b.h; }

        if (hasContent) {
          sep(y + 2);
          doc.setFont(undefined, 'bold');
          doc.setFontSize(8);
          doc.text(`CONTENIDO (${trackings.length})`, 5, y + 5.5);
          doc.setFont('courier', 'normal');
          doc.setFontSize(7);
          y += contentH;
          trackings.slice(0, shown).forEach((t) => {
            doc.text(String(t).slice(0, 48), 5, y + 2.2);
            y += CONTENT_LINE_H;
          });
          if (truncated) doc.text(`+${trackings.length - shown} más`, 5, y + 2.2);
        }

        doc.save(`etiqueta-${bulto.label_code}.pdf`);
      }
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