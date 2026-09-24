import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Layers, ChevronDown, ChevronUp, Loader2, X, CheckCircle2,
  FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import UniversalClientSearch from '@/components/warehouse/UniversalClientSearch';
import BluetoothPrinter from '@/components/warehouse/BluetoothPrinter';
import { bulkPut } from '@/lib/offlineDb';

// Crea N bultos vacíos en secuencia para un cliente (offline-first).
// Reutiliza el bloque de números global (getNextNumber) para asignar bulto_number únicos.
// Crea los bultos en IndexedDB con status 'activo' para que el operador pueda escanear paquetes en ellos después.
// Ofrece imprimir todas las etiquetas vía Bluetooth o descargar un PDF combinado.
export default function BulkBultoCreator({ getNextNumber, user, onCreated, enqueueClosedBulto }) {
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState(null);
  const [count, setCount] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createdBultos, setCreatedBultos] = useState([]);
  const [printing, setPrinting] = useState(false);

  const reset = () => {
    setClient(null);
    setCount(1);
    setCreatedBultos([]);
  };

  const handleCreate = useCallback(async () => {
    if (!client) {
      toast.error('Selecciona un cliente primero');
      return;
    }
    if (!client.shipping_mark) {
      toast.error('El cliente no tiene shipping mark asignado');
      return;
    }
    const n = Math.max(1, Math.min(50, Math.floor(Number(count) || 1)));
    if (n !== Number(count)) setCount(n);

    setCreating(true);
    try {
      // Reservar N números secuenciales del bloque global
      const numbers = [];
      for (let i = 0; i < n; i++) {
        const num = await getNextNumber();
        if (!num) {
          toast.error('No hay números de bulto disponibles. Revisa tu conexión.');
          return;
        }
        numbers.push(num);
      }

      const totalBultos = numbers[numbers.length - 1];
      const shippingMark = client.shipping_mark || '';
      const clientSnapshot = {
        full_name: client.full_name || '',
        email: client.email || '',
        cedula: client.cedula || '',
        whatsapp: client.whatsapp || '',
        address: client.address || '',
        city: client.city || '',
        state: client.state || '',
        shipping_mark: shippingMark,
      };

      const now = Date.now();
      const closedAt = new Date().toISOString();
      const newBultos = numbers.map((num, i) => ({
        id: `local_bulto_${now}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        label_code: `${shippingMark}-B${num}`,
        client_email: client.email,
        shipping_mark: shippingMark,
        bulto_number: num,
        total_bultos: totalBultos,
        package_ids: [],
        package_trackings: [],
        client_snapshot: clientSnapshot,
        invoice_paid: false,
        invoice_status: '',
        invoice_number: '',
        warehouse_id: '',
        status: 'despachado',
        closed_at: closedAt,
        created_by: user?.email || '',
        is_local: true,
      }));

      await bulkPut('bultos', newBultos);
      setCreatedBultos(newBultos);
      onCreated?.(newBultos);

      // Encolar sincronización inmediata de todos los bultos cerrados
      if (enqueueClosedBulto) {
        for (const b of newBultos) {
          try {
            await enqueueClosedBulto({
              local_bulto_id: b.id,
              label_code: b.label_code,
              client_email: b.client_email,
              shipping_mark: b.shipping_mark,
              bulto_number: b.bulto_number,
              total_bultos: b.total_bultos,
              package_ids: [],
              package_trackings: [],
              client_snapshot: b.client_snapshot || {},
              invoice_paid: false,
              invoice_status: '',
              invoice_number: '',
              warehouse_id: '',
              created_by: b.created_by,
              closed_at: b.closed_at,
            });
          } catch (e) {
            console.error('Error encolando bulto del lote:', e);
          }
        }
      }

      toast.success(`${n} bulto${n !== 1 ? 's' : ''} creado${n !== 1 ? 's' : ''} y cerrado${n !== 1 ? 's' : ''} para ${client.full_name || client.email}`);
    } catch (e) {
      console.error('Bulk bulto create error:', e);
      toast.error('Error al crear los bultos');
    } finally {
      setCreating(false);
    }
  }, [client, count, getNextNumber, user, onCreated, enqueueClosedBulto]);

  // PDF combinado: todas las etiquetas en un solo archivo multi-página
  const downloadCombinedPdf = useCallback(async () => {
    if (!createdBultos.length) return;
    setPrinting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const JsBarcode = (await import('jsbarcode')).default;

      const doc = new jsPDF({ unit: 'mm', format: [100, 100] });

      createdBultos.forEach((bulto, idx) => {
        if (idx > 0) doc.addPage();
        const cs = bulto.client_snapshot || {};
        const pkgCount = bulto.package_ids?.length || bulto.package_trackings?.length || 0;
        let y = 5;

        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, bulto.label_code, { format: 'CODE128', width: 4, height: 80, displayValue: true, fontSize: 18, margin: 0 });
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 85;
          const imgHeight = (canvas.height / canvas.width) * imgWidth;
          doc.addImage(imgData, 'PNG', (100 - imgWidth) / 2, y, imgWidth, imgHeight);
          y += imgHeight + 3;
        } catch (_) {}

        doc.setLineWidth(0.3);
        doc.line(5, y, 95, y);
        y += 4;

        doc.setFontSize(28);
        doc.setTextColor(0);
        doc.setFont(undefined, 'bold');
        doc.text((cs.state || 'SIN ESTADO').toUpperCase(), 50, y + 5, { align: 'center' });
        y += 12;

        doc.setLineWidth(0.3);
        doc.line(5, y, 95, y);
        y += 5;

        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text(`BULTO ${bulto.bulto_number}/${bulto.total_bultos} - ${pkgCount} PAQUETES`, 50, y, { align: 'center' });
        y += 7;

        doc.setLineWidth(0.3);
        doc.line(5, y, 95, y);
        y += 5;

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
      });

      const firstName = (client?.shipping_mark || 'bultos').replace(/[^a-zA-Z0-9]/g, '');
      doc.save(`etiquetas-${firstName}-${createdBultos.length}.pdf`);
      toast.success(`${createdBultos.length} etiquetas en un PDF`);
    } catch (e) {
      toast.error(`Error generando PDF: ${e?.message || ''}`);
    } finally {
      setPrinting(false);
    }
  }, [createdBultos, client]);

  return (
    <Card className="border-blue-200">
      <button
        onClick={() => { setOpen((v) => !v); if (open) reset(); }}
        className="w-full flex items-center justify-between gap-2 p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-600" />
          <div>
            <p className="font-semibold text-slate-800 text-sm">Crear bultos en lote</p>
            <p className="text-xs text-slate-500">Genera varios bultos cerrados para un cliente (cuando no se puede escanear)</p>
          </div>
        </div>
        {open ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
      </button>

      {open && (
        <CardContent className="pt-0 space-y-4">
          {/* Paso 1: seleccionar cliente */}
          {!createdBultos.length && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600">1. Buscar cliente</Label>
                {client ? (
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50/50 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {client.full_name || client.email}
                      </p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                        {client.shipping_mark && <span className="font-mono">{client.shipping_mark}</span>}
                        {client.cedula && <span>C.I. {client.cedula}</span>}
                        {client.state && <span>{client.state}</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setClient(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <UniversalClientSearch onSelect={setClient} placeholder="Buscar cliente por shipping mark, nombre, email o cédula…" />
                )}
              </div>

              {/* Paso 2: cantidad */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600">2. Cantidad de bultos</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    className="w-28"
                    disabled={creating}
                  />
                  <span className="text-xs text-slate-500">bultos vacíos (máx. 50)</span>
                </div>
              </div>

              {/* Crear */}
              <Button
                onClick={handleCreate}
                disabled={!client || creating}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {creating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creando…</>
                ) : (
                  <><Layers className="h-4 w-4" /> Crear {count > 1 ? `${count} bultos` : 'bulto'}</>
                )}
              </Button>
            </>
          )}

          {/* Resultado: bultos creados */}
          {createdBultos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-medium text-sm">
                  {createdBultos.length} bulto{createdBultos.length !== 1 ? 's' : ''} creado{createdBultos.length !== 1 ? 's' : ''} — {createdBultos[0].shipping_mark}
                </p>
              </div>

              {/* Lista de label_codes */}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {createdBultos.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                      <span className="font-mono text-slate-700 break-all">{b.label_code}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Impresión y PDF */}
              <div className="flex flex-wrap gap-2">
                <BluetoothPrinter bultos={createdBultos} onPrinted={() => {}} />
                <Button
                  variant="outline"
                  onClick={downloadCombinedPdf}
                  disabled={printing}
                >
                  {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  PDF combinado
                </Button>
                <Button
                  variant="ghost"
                  onClick={reset}
                  className="ml-auto"
                >
                  Crear otros
                </Button>
              </div>

              <p className="text-xs text-slate-500">
                Los bultos ya están cerrados y encolados para sincronización. Imprime las etiquetas ahora.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}