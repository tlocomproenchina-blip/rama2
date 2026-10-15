import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layers, ChevronDown, ChevronUp, Loader2, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import UniversalClientSearch from '@/components/warehouse/UniversalClientSearch';
import BulkBultoResultPanel from '@/components/warehouse/BulkBultoResultPanel';
import { downloadCombinedBultoLabelsPdf } from '@/lib/bulkBultoLabelsPdf';
import { getAll, bulkPut, put } from '@/lib/offlineDb';

// Crea N bultos vacíos en secuencia para un cliente (offline-first).
// Reutiliza el bloque de números global (getNextNumber) para asignar bulto_number únicos.
// Los bultos se crean sellados ('en_almacen_ve') y encolados para sincronizar como
// siempre; el panel de resultado muestra etiqueta por etiqueta si quedó registrada en
// el sistema, pendiente de sincronizar o no registrada por código repetido.
// El N° de contenedor escrito aquí se aplica a TODAS las etiquetas del lote.
const parseOrders = (raw) =>
  String(raw || '')
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);

export default function BulkBultoCreator({
  getNextNumber,
  user,
  onCreated,
  enqueueClosedBulto,
  pendingBultos = [],
  retrySync,
  onDiscardBulto,
}) {
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState(null);
  const [count, setCount] = useState(1);
  const [orders, setOrders] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdBultos, setCreatedBultos] = useState([]);
  const [statusById, setStatusById] = useState({});
  const [replacingId, setReplacingId] = useState('');
  const [printing, setPrinting] = useState(false);

  const orderList = useMemo(() => parseOrders(orders), [orders]);

  const reset = () => {
    setClient(null);
    setCount(1);
    setOrders('');
    setCreatedBultos([]);
    setStatusById({});
  };

  // Objeto que viaja a la cola de sincronización (incluye el N° de contenedor del lote).
  const queuePayload = useCallback((b) => ({
    local_bulto_id: b.id,
    label_code: b.label_code,
    client_email: b.client_email,
    shipping_mark: b.shipping_mark,
    bulto_number: b.bulto_number,
    total_bultos: b.total_bultos,
    package_ids: b.package_ids || [],
    package_trackings: b.package_trackings || [],
    client_snapshot: b.client_snapshot || {},
    invoice_paid: false,
    invoice_status: '',
    invoice_number: '',
    cbm_order_numbers: b.cbm_order_numbers || [],
    warehouse_id: b.warehouse_id || '',
    created_by: b.created_by || '',
    closed_at: b.closed_at,
  }), []);

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
        cbm_order_numbers: orderList,
        client_snapshot: clientSnapshot,
        invoice_paid: false,
        invoice_status: '',
        invoice_number: '',
        warehouse_id: '',
        status: 'en_almacen_ve',
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
            await enqueueClosedBulto(queuePayload(b));
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
  }, [client, count, orderList, getNextNumber, user, onCreated, enqueueClosedBulto, queuePayload]);

  // Estado real de registro de cada etiqueta: se lee del dispositivo cada vez que
  // cambia la cola de sincronización (al procesarse, el bulto queda enlazado al
  // servidor o marcado como código repetido).
  useEffect(() => {
    if (!createdBultos.length) return undefined;
    let cancelled = false;
    (async () => {
      let records = [];
      try {
        records = await getAll('bultos');
      } catch (_) {}
      if (cancelled) return;
      const next = {};
      createdBultos.forEach((b) => {
        const rec = records.find((r) => r.id === b.id);
        const queued = pendingBultos.find((p) => p.id === b.id);
        if (rec?.sync_duplicate) next[b.id] = 'duplicado';
        else if (rec?.synced || rec?.server_bulto_id) next[b.id] = 'registrado';
        else if (queued?.sync_status === 'error') next[b.id] = 'error';
        else next[b.id] = 'pendiente';
      });
      setStatusById(next);
    })();
    return () => { cancelled = true; };
  }, [createdBultos, pendingBultos]);

  const summary = useMemo(() => {
    const values = createdBultos.map((b) => statusById[b.id] || 'pendiente');
    return {
      registrados: values.filter((v) => v === 'registrado').length,
      pendientes: values.filter((v) => v === 'pendiente' || v === 'error').length,
      duplicados: values.filter((v) => v === 'duplicado').length,
    };
  }, [createdBultos, statusById]);

  // Código repetido: la etiqueta nunca existió en el sistema (ese número ya estaba
  // usado). Se genera esa etiqueta de nuevo con un número nuevo y se descarta la
  // que no se registró, para no imprimirla por error.
  const handleReplaceDuplicate = useCallback(async (bulto) => {
    setReplacingId(bulto.id);
    try {
      const num = await getNextNumber();
      if (!num) {
        toast.error('No hay números de bulto disponibles. Revisa tu conexión.');
        return;
      }
      const replacement = {
        ...bulto,
        id: `local_bulto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label_code: `${bulto.shipping_mark}-B${num}`,
        bulto_number: num,
        synced: false,
        server_bulto_id: '',
        sync_duplicate: false,
      };
      await put('bultos', replacement);
      await onDiscardBulto?.(bulto);
      setCreatedBultos((prev) => prev.map((b) => (b.id === bulto.id ? replacement : b)));
      onCreated?.([replacement]);
      if (enqueueClosedBulto) await enqueueClosedBulto(queuePayload(replacement));
      toast.success(`Etiqueta nueva generada: ${replacement.label_code}`);
    } catch (e) {
      toast.error('No se pudo generar la etiqueta nueva');
    } finally {
      setReplacingId('');
    }
  }, [getNextNumber, onDiscardBulto, onCreated, enqueueClosedBulto, queuePayload]);

  const downloadCombinedPdf = useCallback(async () => {
    if (!createdBultos.length) return;
    setPrinting(true);
    try {
      const count = await downloadCombinedBultoLabelsPdf({
        bultos: createdBultos,
        nameHint: client?.shipping_mark || 'bultos',
      });
      toast.success(`${count} etiquetas en un PDF`);
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
          {!createdBultos.length ? (
            <>
              {/* Paso 1: seleccionar cliente */}
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

              {/* Paso 3: número de contenedor del lote */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600">3. N° de contenedor (opcional)</Label>
                <Input
                  value={orders}
                  onChange={(e) => setOrders(e.target.value)}
                  placeholder="Ej: 12345 o 12345, 67890"
                  disabled={creating}
                />
                <p className="text-xs text-slate-500">
                  {orderList.length
                    ? `Se guarda en todas las etiquetas del lote y sale impreso como CONTENEDOR ${orderList.join(', ')}.`
                    : 'Se aplica a todas las etiquetas del lote (puedes escribir varios separados por coma).'}
                </p>
              </div>

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
          ) : (
            <BulkBultoResultPanel
              createdBultos={createdBultos}
              statusById={statusById}
              summary={summary}
              orderNumbers={orderList}
              shippingMark={createdBultos[0]?.shipping_mark || ''}
              replacingId={replacingId}
              printing={printing}
              onReplaceDuplicate={handleReplaceDuplicate}
              onDownloadPdf={downloadCombinedPdf}
              onReset={reset}
              retrySync={retrySync}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}