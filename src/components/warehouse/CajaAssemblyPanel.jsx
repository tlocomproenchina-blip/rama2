import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Boxes, Layers, Loader2, Package, Plus, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import ScanClientPicker from '@/components/warehouse/ScanClientPicker';
import AbsorbBultosConfirmDialog from '@/components/warehouse/AbsorbBultosConfirmDialog';
import CajaActiveCard from './CajaActiveCard';
import CajaLotList from './CajaLotList';
import CajaLabelsDialog from './CajaLabelsDialog';
import {
  blockNumberFromCode, isBultoCode, isCajaCode, markOfBlockCode,
} from '@/lib/cajaCodes';
import {
  absorbBultoIntoLocalCaja, addPackageToLocalCaja, cajaContents, createLocalCaja,
  findLocalBultoByCode, findLocalClientByMark, findLocalPackage, localCajasOfClient, saveLocalCaja,
} from '@/lib/cajaLocal';

// Armado de la caja consolidada en el almacén de Venezuela.
//
// El operador abre la caja (con su código -C## o generándolo para un cliente), escanea
// dentro los bultos pequeños y los paquetes sueltos, y al cerrarla se sincroniza: los
// bultos absorbidos se eliminan en el servidor y la caja queda como la unidad que se
// despacha. Todo el armado se resuelve contra el caché del dispositivo, así que la
// conexión no detiene el trabajo.
export default function CajaAssemblyPanel({ user, getNextNumber, enqueueCaja }) {
  const [caja, setCaja] = useState(null);
  const [contents, setContents] = useState({ package_count: 0, cbm: 0 });
  const [ordersText, setOrdersText] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [absorbPending, setAbsorbPending] = useState(null);
  const [pendingCode, setPendingCode] = useState(null);
  const [clientPrompt, setClientPrompt] = useState(null);
  const [lastClientEmail, setLastClientEmail] = useState('');
  const [cajas, setCajas] = useState([]);
  const [lotKey, setLotKey] = useState(0);
  const [labelsOpen, setLabelsOpen] = useState(false);

  const deviceId = useMemo(() => {
    try {
      return localStorage.getItem('tlec_warehouse_device_id') || '';
    } catch (_) {
      return '';
    }
  }, []);

  const refreshLot = useCallback(async () => {
    if (!lastClientEmail) {
      setCajas([]);
      return;
    }
    const list = await localCajasOfClient(lastClientEmail).catch(() => []);
    setCajas(list);
  }, [lastClientEmail]);

  useEffect(() => {
    refreshLot();
  }, [refreshLot, lotKey]);

  const activate = useCallback(async (active) => {
    setCaja(active);
    setLastClientEmail(active?.client_email || '');
    setContents(await cajaContents(active).catch(() => ({ package_count: 0, cbm: 0 })));
    setOrdersText((active?.cbm_order_numbers || []).join(', '));
  }, []);

  // --- Abrir la caja ---
  const handleCajaCode = useCallback(async (value) => {
    const existing = await findLocalBultoByCode(value);
    if (existing && !existing.is_caja) {
      setError('Ese código es de un bulto suelto (-B##). La caja usa su propio código -C##.');
      return;
    }
    if (existing?.status === 'despachado') {
      setError('Esa caja ya fue despachada.');
      return;
    }
    if (existing) {
      await activate(existing);
      toast.success(`Caja ${existing.label_code} abierta`);
      return;
    }
    const mark = markOfBlockCode(value);
    const client = await findLocalClientByMark(mark);
    if (!client) {
      setClientPrompt({ code: value, mark, client: null });
      setError(`No se encontró el cliente del shipping mark ${mark || 'del código'}.`);
      return;
    }
    const number = blockNumberFromCode(value) || (await getNextNumber());
    if (!number) {
      setError('No hay números disponibles para la caja. Revisa tu conexión.');
      return;
    }
    const created = await createLocalCaja({ client, number, user });
    await activate(created);
    toast.success(`Caja ${created.label_code} lista para armar`);
  }, [activate, getNextNumber, user]);

  const handleOpenForClient = useCallback(async (client) => {
    const number = await getNextNumber();
    if (!number) {
      setError('No hay números disponibles para la caja. Revisa tu conexión.');
      return;
    }
    const created = await createLocalCaja({ client, number, user });
    await activate(created);
    setClientPrompt(null);
    toast.success(`Caja ${created.label_code} lista para armar`);
  }, [activate, getNextNumber, user]);

  // --- Escaneo dentro de la caja ---
  const handleScan = useCallback(async (raw) => {
    const value = String(raw || '').trim();
    if (!value || busy) return;
    setBusy(true);
    setError('');
    setCode('');
    try {
      if (isCajaCode(value)) {
        await handleCajaCode(value);
        return;
      }
      if (!caja) {
        setError('Abre primero la caja: escanea su código (termina en -C##) o usa Abrir caja.');
        return;
      }

      if (isBultoCode(value)) {
        const source = await findLocalBultoByCode(value);
        if (source?.is_caja) {
          setError('Ese código es de otra caja consolidada.');
          return;
        }
        if (source) {
          if (source.client_email && source.client_email !== caja.client_email) {
            setError('Ese bulto es de otro cliente: una caja no puede mezclar clientes.');
            return;
          }
          setAbsorbPending({ source, code: value });
          return;
        }
        // No está en el dispositivo: al sincronizar el servidor lo resuelve por su código.
        setPendingCode({ code: value, reason: 'no está registrado en este dispositivo' });
        return;
      }

      const pkg = await findLocalPackage(value);
      if (pkg) {
        if (pkg.client_email && pkg.client_email !== caja.client_email) {
          setError('Ese paquete es de otro cliente: una caja no puede mezclar clientes.');
          return;
        }
        const updated = await addPackageToLocalCaja(caja, { pkg, code: value });
        await activate(updated);
        toast.success(`Paquete ${pkg.tracking_number || value} dentro de la caja`, { duration: 1500 });
        return;
      }
      setPendingCode({ code: value, reason: 'no está registrado en el sistema' });
    } catch (e) {
      setError('Error al procesar el escaneo');
    } finally {
      setBusy(false);
    }
  }, [activate, busy, caja, handleCajaCode]);

  const confirmAbsorb = useCallback(async () => {
    if (!absorbPending || !caja) return;
    const { source } = absorbPending;
    const updated = await absorbBultoIntoLocalCaja(caja, source);
    setAbsorbPending(null);
    await activate(updated);
    toast.success(`Bulto ${source.label_code || ''} absorbido dentro de la caja`);
  }, [absorbPending, activate, caja]);

  const confirmUnregistered = useCallback(async () => {
    if (!pendingCode || !caja) return;
    const updated = await addPackageToLocalCaja(caja, { code: pendingCode.code });
    setPendingCode(null);
    await activate(updated);
    toast.success(`Código ${pendingCode.code} agregado sin registrar`);
  }, [activate, caja, pendingCode]);

  const removeUnregistered = useCallback(async (target) => {
    if (!caja) return;
    const updated = {
      ...caja,
      unregistered_codes: (caja.unregistered_codes || []).filter((c) => c !== target),
      package_trackings: (caja.package_trackings || []).filter((c) => c !== target),
    };
    await saveLocalCaja(updated);
    await activate(updated);
  }, [activate, caja]);

  // --- Cerrar la caja: queda en almacén y se sincroniza en segundo plano ---
  const handleClose = useCallback(async () => {
    if (!caja || !enqueueCaja) return;
    const orders = ordersText.split(',').map((s) => s.trim()).filter(Boolean);
    if (!orders.length) {
      setError('Ingresa al menos un N° de orden para cerrar la caja.');
      return;
    }
    setBusy(true);
    setError('');
    const closed = {
      ...caja,
      status: 'en_almacen_ve',
      closed_at: new Date().toISOString(),
      cbm_order_numbers: orders,
      cargo_package_count: contents.package_count || 0,
      ...(contents.cbm > 0 ? { cargo_cbm: contents.cbm } : {}),
    };
    try {
      await saveLocalCaja(closed);
      await enqueueCaja({
        local_bulto_id: closed.local_bulto_id || closed.id,
        label_code: closed.label_code,
        client_email: closed.client_email,
        package_codes: [
          ...(closed.package_trackings || []),
          ...(closed.unregistered_codes || []),
          ...(closed.absorbed_codes || []),
        ],
        absorb_codes: closed.absorbed_codes || [],
        unregistered_codes: closed.unregistered_codes || [],
        cbm_order_numbers: orders,
      });
      toast.success(`Caja ${closed.label_code} cerrada: se sincroniza en segundo plano`);
      setCaja(null);
      setContents({ package_count: 0, cbm: 0 });
      setOrdersText('');
      setLotKey((key) => key + 1);
    } catch (e) {
      setError('No se pudo cerrar la caja');
    } finally {
      setBusy(false);
    }
  }, [caja, contents, enqueueCaja, ordersText]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-primary" /> Armar caja consolidada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Abre la caja con su código (termina en <span className="font-mono">-C##</span>) y escanea
          dentro los bultos pequeños y los paquetes sueltos. Al cerrarla, esos bultos se absorben y el
          contenido queda dentro de la caja, que es lo que se despacha.
        </p>

        {!caja && (
          <Button variant="outline" className="w-full gap-2" onClick={() => setClientPrompt({ code: '', mark: '', client: null })}>
            <Plus className="h-4 w-4" /> Abrir caja nueva
          </Button>
        )}

        <BarcodeScannerModule
          title="Escaneo de la caja"
          description="Escanea el código de la caja (-C##) para abrirla y, después, el código de cada bulto (-B##), etiqueta o tracking que va adentro."
          placeholder="Caja (-C##), bulto (-B##) o tracking"
          actionLabel="Agregar"
          value={code}
          onValueChange={setCode}
          onDetected={handleScan}
          continuous={true}
        />

        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Procesando…
          </p>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}

        {clientPrompt && (
          <ScanClientPicker
            candidateClient={clientPrompt.client}
            selectedClient={null}
            deviceId={deviceId}
            onSelect={handleOpenForClient}
          />
        )}

        {pendingCode && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="space-y-3 pt-4">
              <p className="flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  El código <span className="font-mono font-semibold break-all">{pendingCode.code}</span>{' '}
                  {pendingCode.reason}. Puedes agregarlo igual a la caja: queda marcado como "sin
                  registrar" y el conteo lo toma como un paquete más.
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={confirmUnregistered} disabled={busy}>
                  <Package className="h-4 w-4" /> Agregar igual
                </Button>
                <Button variant="outline" onClick={() => setPendingCode(null)} disabled={busy}>
                  Descartar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {caja ? (
          <CajaActiveCard
            caja={caja}
            contents={contents}
            ordersText={ordersText}
            onOrdersChange={setOrdersText}
            onClose={handleClose}
            onRemoveUnregistered={removeUnregistered}
            busy={busy}
          />
        ) : (
          !clientPrompt && (
            <p className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
              <ScanLine className="h-4 w-4 shrink-0" /> Abre una caja para empezar a escanear bultos
              adentro.
            </p>
          )
        )}

        <CajaLotList cajas={cajas} onPrintLabels={() => setLabelsOpen(true)} />

        <AbsorbBultosConfirmDialog
          open={!!absorbPending}
          sources={
            absorbPending
              ? [{
                  ...absorbPending.source,
                  package_count:
                    (absorbPending.source.package_ids || []).length +
                    (absorbPending.source.unregistered_codes || []).length,
                  order_numbers: absorbPending.source.cbm_order_numbers || [],
                }]
              : []
          }
          codes={absorbPending ? [absorbPending.code] : []}
          clientEmail={caja?.client_email || ''}
          busy={busy}
          onConfirm={confirmAbsorb}
          onCancel={() => setAbsorbPending(null)}
        />

        <CajaLabelsDialog
          open={labelsOpen}
          onOpenChange={setLabelsOpen}
          clientEmail={lastClientEmail}
          onPrinted={() => setLotKey((key) => key + 1)}
        />

        {cajas.length > 0 && (
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Boxes className="h-3.5 w-3.5 shrink-0" /> {cajas.length} caja(s) de este cliente esperando
            despacho.
          </p>
        )}
      </CardContent>
    </Card>
  );
}