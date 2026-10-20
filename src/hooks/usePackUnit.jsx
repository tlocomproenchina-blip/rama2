import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { del, getAll, put } from '@/lib/offlineDb';
import { blockNumberFromCode, isBultoCode, isCajaCode, markOfBlockCode } from '@/lib/cajaCodes';
import {
  absorbBultoIntoLocalCaja, cajaContents, createLocalCaja, dropLocalBultoFromQueue,
  findLocalBultoByCode, findLocalClientByMark, findLocalPackage, saveLocalCaja,
} from '@/lib/cajaLocal';
import { addPackageToUnit, createLocalBulto, findOpenUnit, loadOpenUnits, sameClient, saveUnit } from '@/lib/packUnits';

// Mesa única de empaque: un solo escáner recibe paquetes, arma bultos y arma la caja
// consolidada. El selector decide el destino del próximo escaneo y la unidad que el
// cliente ya tenía abierta se retoma sola, sin abrir nada a mano.
export default function usePackUnit({
  user, getNextNumber, getClientByEmail, enqueueClosedBulto, enqueueCaja, enqueuePackageReception,
  enqueuePrint, captureScanPhoto, onHistoryChange,
}) {
  const [destination, setDestination] = useState('caja');
  const [units, setUnits] = useState([]);
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [pendingCode, setPendingCode] = useState(null);
  const [absorbPending, setAbsorbPending] = useState(null);
  const [manualAssign, setManualAssign] = useState(null);
  const [clientPrompt, setClientPrompt] = useState(null);
  const [ordersText, setOrdersText] = useState('');
  const [contents, setContents] = useState({ package_count: 0, cbm: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const unitsRef = useRef([]);
  const activeUnitRef = useRef(null);
  const destinationRef = useRef('caja');
  const busyRef = useRef(false);

  const deviceId = useMemo(() => {
    try {
      return localStorage.getItem('tlec_warehouse_device_id') || '';
    } catch (_) {
      return '';
    }
  }, []);

  const activeUnit = useMemo(
    () => units.find((u) => u.id === activeUnitId) || null,
    [units, activeUnitId]
  );
  activeUnitRef.current = activeUnit;

  useEffect(() => { destinationRef.current = destination; }, [destination]);

  const applyUnits = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(unitsRef.current) : updater;
    unitsRef.current = next;
    setUnits(next);
  }, []);

  const selectUnit = useCallback((id) => {
    activeUnitRef.current = unitsRef.current.find((u) => u.id === id) || null;
    setActiveUnitId(id);
  }, []);

  const changeDestination = useCallback((value) => {
    destinationRef.current = value;
    setDestination(value);
    setError('');
  }, []);

  // --- Unidad activa ---
  const activateUnit = useCallback(async (unit) => {
    if (!unit) return null;
    applyUnits((prev) =>
      prev.some((u) => u.id === unit.id)
        ? prev.map((u) => (u.id === unit.id ? unit : u))
        : [...prev, unit]
    );
    activeUnitRef.current = unit;
    setActiveUnitId(unit.id);
    changeDestination(unit.is_caja ? 'caja' : 'bulto');
    setOrdersText((unit.cbm_order_numbers || []).join(', '));
    setError('');
    if (unit.is_caja) {
      setContents(await cajaContents(unit).catch(() => ({ package_count: 0, cbm: 0 })));
    }
    return unit;
  }, [applyUnits, changeDestination]);

  const reloadUnits = useCallback(async () => {
    const open = await loadOpenUnits();
    applyUnits(open);
    if (!open.some((u) => u.id === activeUnitRef.current?.id)) {
      selectUnit(open[0]?.id || null);
    }
    return open;
  }, [applyUnits, selectUnit]);

  // --- Abrir / retomar unidades ---
  const openCajaByCode = useCallback(async (code) => {
    const existing = await findLocalBultoByCode(code);
    if (existing && !existing.is_caja) {
      setError('Ese código es de un bulto suelto (-B##). La caja usa su propio código -C##.');
      return;
    }
    if (existing?.status === 'despachado') {
      setError('Esa caja ya fue despachada.');
      return;
    }
    if (existing) {
      await activateUnit(existing);
      toast.success(`Caja ${existing.label_code} retomada`);
      return;
    }
    const mark = markOfBlockCode(code);
    const client = mark ? await findLocalClientByMark(mark) : null;
    if (!client) {
      setClientPrompt({ code, mark, client: null });
      setError(`No se encontró el cliente del shipping mark ${mark || 'del código'}.`);
      return;
    }
    const number = blockNumberFromCode(code) || (await getNextNumber());
    if (!number) {
      setError('No hay números disponibles para la caja. Revisa tu conexión.');
      return;
    }
    const created = await createLocalCaja({ client, number, user });
    await activateUnit(created);
    toast.success(`Caja ${created.label_code} lista para armar`);
  }, [activateUnit, getNextNumber, user]);

  // Unidad nueva para el cliente elegido a mano (picker de cliente).
  const openForClient = useCallback(async (client) => {
    const number = await getNextNumber();
    if (!number) {
      setError('No hay números disponibles. Revisa tu conexión.');
      return;
    }
    const created = destinationRef.current === 'caja'
      ? await createLocalCaja({ client, number, user })
      : await createLocalBulto({ client, number, user });
    setClientPrompt(null);
    await activateUnit(created);
    toast.success(`${created.is_caja ? 'Caja' : 'Bulto'} ${created.label_code} listo para armar`);
  }, [activateUnit, getNextNumber, user]);

  // Unidad que recibe el escaneo: la abierta del cliente o una nueva con número reservado.
  const resolveUnit = useCallback(async (clientEmail, client, kind) => {
    const existing = await findOpenUnit(clientEmail, kind);
    if (existing) return existing;
    const number = await getNextNumber();
    if (!number) {
      setError('No hay números de bulto disponibles. Revisa tu conexión.');
      return null;
    }
    const base = client || { email: clientEmail };
    return kind === 'caja'
      ? createLocalCaja({ client: base, number, user })
      : createLocalBulto({ client: base, number, user });
  }, [getNextNumber, user]);

  // --- Escaneo único: la misma lectura para bultos, cajas y paquetes ---
  const handleScan = useCallback(async (raw) => {
    const value = String(raw || '').trim();
    if (!value || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setPendingCode(null);
    setManualAssign(null);
    try {
      if (isCajaCode(value)) {
        await openCajaByCode(value);
        return;
      }

      if (isBultoCode(value)) {
        const target = await findLocalBultoByCode(value);
        const active = activeUnitRef.current;
        if (active?.is_caja) {
          if (!target) {
            setPendingCode({ code: value, reason: 'no está registrado en este dispositivo' });
            return;
          }
          if (target.is_caja) {
            setError('Ese código es de otra caja consolidada.');
            return;
          }
          if (!sameClient(target.client_email, active.client_email)) {
            setError('Ese bulto es de otro cliente: una caja no puede mezclar clientes.');
            return;
          }
          setAbsorbPending({ source: target, code: value });
          return;
        }
        if (!target) {
          setPendingCode({ code: value, reason: 'no está registrado en este dispositivo' });
          return;
        }
        if (target.is_caja) {
          setError('Ese código es de otra caja consolidada.');
          return;
        }
        // En modo caja el bulto suelto no se retoma: entra dentro de la caja del cliente.
        // Se retoma la caja abierta del cliente o se crea, y queda como unidad activa para
        // que el escaneo siga armando la caja (con bultos sueltos y con trackings).
        if (destinationRef.current === 'caja') {
          const client = target.client_email ? await getClientByEmail(target.client_email) : null;
          const caja = await resolveUnit(
            target.client_email,
            client || { email: target.client_email, shipping_mark: target.shipping_mark },
            'caja'
          );
          if (!caja) return;
          await activateUnit(caja);
          setAbsorbPending({ source: target, code: value });
          return;
        }
        await activateUnit(target);
        toast.success(`Bulto ${target.label_code} activo`);
        return;
      }

      let pkg = await findLocalPackage(value);
      if (!pkg) {
        setPendingCode({ code: value, reason: 'no está registrado en el sistema' });
        return;
      }

      const client = pkg.client_email ? await getClientByEmail(pkg.client_email) : null;
      const alreadyReceived = pkg.status === 'recibido' || pkg.status === 'despachado';
      const wasPreAlert = pkg.status === 'pre_alerta';

      if (!alreadyReceived) {
        const updatedPkg = {
          ...pkg,
          status: 'recibido',
          received_date: new Date().toISOString(),
          received_by: user?.email || '',
        };
        await put('packages', updatedPkg);
        pkg = updatedPkg;
        enqueuePackageReception(updatedPkg);
      }

      const unit = await resolveUnit(
        pkg.client_email,
        client || { email: pkg.client_email, shipping_mark: pkg.shipping_mark },
        destinationRef.current
      );
      if (!unit) return;

      const updated = await addPackageToUnit(unit, { pkg });
      await activateUnit(updated);
      setLastScan({ pkg, client, already_received: alreadyReceived, auto_received: wasPreAlert });
      toast.success(`Recibido y dentro de ${updated.label_code}`, { duration: 1500 });
      if (captureScanPhoto) captureScanPhoto(value, pkg).catch(() => {});
    } catch (e) {
      console.error('Scan error:', e);
      setError('Error al procesar el escaneo');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [activateUnit, captureScanPhoto, enqueuePackageReception, getClientByEmail, openCajaByCode, resolveUnit, user]);

  // --- Códigos sin registrar y asignación manual ---
  const confirmUnregistered = useCallback(async () => {
    const active = activeUnitRef.current;
    if (!pendingCode || !active) return;
    const updated = await addPackageToUnit(active, { code: pendingCode.code });
    const code = pendingCode.code;
    setPendingCode(null);
    await activateUnit(updated);
    toast.success(`Código ${code} agregado sin registrar`);
  }, [activateUnit, pendingCode]);

  const startManualAssign = useCallback(() => {
    if (!pendingCode) return;
    setManualAssign({ tracking: pendingCode.code });
    setPendingCode(null);
  }, [pendingCode]);

  const handleManualAssign = useCallback(async (client) => {
    if (!manualAssign) return;
    const { tracking } = manualAssign;
    setManualAssign(null);
    try {
      const pkg = {
        id: `local_pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tracking_number: tracking,
        client_email: client.email,
        shipping_mark: client.shipping_mark || '',
        shipping_type: 'maritimo',
        status: 'recibido',
        description: 'Paquete manual (offline)',
        received_date: new Date().toISOString(),
        received_by: user?.email || '',
        is_local: true,
      };
      await put('packages', pkg);
      const unit = await resolveUnit(client.email, client, destinationRef.current);
      if (!unit) return;
      const updated = await addPackageToUnit(unit, { pkg });
      await activateUnit(updated);
      setLastScan({ pkg, client, already_received: false, auto_received: true });
      toast.success(`Paquete manual asignado a ${client.full_name || client.email}`);
    } catch (e) {
      toast.error('Error al crear el paquete manual');
      setManualAssign({ tracking });
    }
  }, [activateUnit, manualAssign, resolveUnit, user]);

  // --- Absorber un bulto dentro de la caja (con confirmación en pantalla) ---
  const confirmAbsorb = useCallback(async () => {
    const active = activeUnitRef.current;
    if (!absorbPending || !active?.is_caja) return;
    const { source } = absorbPending;
    const updated = await absorbBultoIntoLocalCaja(active, source);
    // El bulto absorbido ya no se registra por separado al reconectar.
    await dropLocalBultoFromQueue(source);
    applyUnits((prev) => prev.filter((u) => u.id !== source.id));
    setAbsorbPending(null);
    await activateUnit(updated);
    toast.success(`Bulto ${source.label_code || ''} absorbido dentro de la caja`);
  }, [absorbPending, activateUnit, applyUnits]);

  const cancelAbsorb = useCallback(() => setAbsorbPending(null), []);
  const discardPendingCode = useCallback(() => setPendingCode(null), []);
  const cancelManualAssign = useCallback(() => setManualAssign(null), []);
  const cancelClientPrompt = useCallback(() => { setClientPrompt(null); setError(''); }, []);

  const removeUnregistered = useCallback(async (target) => {
    const active = activeUnitRef.current;
    if (!active) return;
    const updated = {
      ...active,
      unregistered_codes: (active.unregistered_codes || []).filter((c) => c !== target),
      package_trackings: (active.package_trackings || []).filter((c) => c !== target),
    };
    await saveLocalCaja(updated);
    await activateUnit(updated);
  }, [activateUnit]);

  // --- Trabajar dentro de la unidad ---
  const saveOrder = useCallback(async (orders) => {
    const unit = activeUnitRef.current;
    if (!unit) return;
    const updated = { ...unit, cbm_order_numbers: orders };
    await saveUnit(updated);
    applyUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    activeUnitRef.current = updated;
    setOrdersText((orders || []).join(', '));
  }, [applyUnits]);

  const removeLast = useCallback(async () => {
    const unit = activeUnitRef.current;
    if (!unit || unit.is_caja) return;
    const ids = unit.package_ids || [];
    if (!ids.length) return;
    const removedId = ids[ids.length - 1];
    const newIds = ids.slice(0, -1);
    try {
      const allPkgs = await getAll('packages');
      const removedPkg = allPkgs.find((p) => p.id === removedId);
      if (removedPkg?.is_local) await del('packages', removedId);

      if (!newIds.length) {
        await del('bultos', unit.id);
        applyUnits((prev) => prev.filter((u) => u.id !== unit.id));
        selectUnit(null);
        toast.success('Bulto vacío eliminado');
      } else {
        const updated = {
          ...unit,
          package_ids: newIds,
          package_trackings: (unit.package_trackings || []).slice(0, -1),
        };
        await saveUnit(updated);
        await activateUnit(updated);
        toast.success('Último paquete quitado del bulto');
      }
    } catch (e) {
      toast.error('Error al quitar el paquete');
    }
  }, [activateUnit, applyUnits, selectUnit]);

  // --- Cerrar la unidad: bulto (etiqueta individual) o caja (etiquetas continuas) ---
  const closeUnit = useCallback(async (ordersOverride) => {
    const unit = activeUnitRef.current;
    if (!unit) return;

    if (unit.is_caja) {
      // El N° de contenedor ya no se pide al cerrar: se toman los que la caja
      // traiga de sus bultos absorbidos y, si no hay, se cierra sin orden y se
      // asigna después.
      const orders = ordersText.split(',').map((s) => s.trim()).filter(Boolean);
      setBusy(true);
      busyRef.current = true;
      setError('');
      const closed = {
        ...unit,
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
          device_id: deviceId,
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
        applyUnits((prev) => prev.filter((u) => u.id !== unit.id));
        selectUnit(null);
        setContents({ package_count: 0, cbm: 0 });
        setOrdersText('');
        onHistoryChange?.();
      } catch (e) {
        setError('No se pudo cerrar la caja');
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
      return;
    }

    let cbmOrderNumbers = Array.isArray(unit.cbm_order_numbers) ? unit.cbm_order_numbers : [];
    if (Array.isArray(ordersOverride) && ordersOverride.length > 0) {
      cbmOrderNumbers = ordersOverride;
    }
    const closed = {
      ...unit,
      status: 'en_almacen_ve',
      closed_at: new Date().toISOString(),
      cbm_order_numbers: cbmOrderNumbers,
    };
    await saveUnit(closed);
    applyUnits((prev) => prev.filter((u) => u.id !== unit.id));
    selectUnit(null);

    await enqueuePrint(closed);
    toast.success(`Bulto ${unit.bulto_number} cerrado — encolado para impresión`);

    await enqueueClosedBulto({
      local_bulto_id: closed.local_bulto_id || closed.id,
      label_code: closed.label_code,
      client_email: closed.client_email,
      shipping_mark: closed.shipping_mark,
      bulto_number: closed.bulto_number,
      total_bultos: closed.total_bultos,
      package_ids: closed.package_ids || [],
      package_trackings: closed.package_trackings || [],
      client_snapshot: closed.client_snapshot || {},
      invoice_paid: closed.invoice_paid || false,
      invoice_status: closed.invoice_status || '',
      invoice_number: closed.invoice_number || '',
      cbm_order_numbers: cbmOrderNumbers,
      warehouse_id: closed.warehouse_id || '',
      created_by: closed.created_by || user?.email || '',
      closed_at: closed.closed_at,
    });

    onHistoryChange?.();
  }, [applyUnits, contents, deviceId, enqueueCaja, enqueueClosedBulto, enqueuePrint, onHistoryChange, ordersText, selectUnit, user]);

  return {
    destination,
    changeDestination,
    units,
    activeUnit,
    activeUnitId,
    selectUnit,
    lastScan,
    pendingCode,
    confirmUnregistered,
    startManualAssign,
    discardPendingCode,
    manualAssign,
    cancelManualAssign,
    handleManualAssign,
    absorbPending,
    confirmAbsorb,
    cancelAbsorb,
    clientPrompt,
    openForClient,
    cancelClientPrompt,
    ordersText,
    setOrdersText,
    contents,
    busy,
    error,
    closeUnit,
    removeLast,
    saveOrder,
    removeUnregistered,
    handleScan,
    reloadUnits,
    deviceId,
  };
}