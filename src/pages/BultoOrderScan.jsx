import React, { useState, useCallback, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import ScanPhotoFailureNotice from '@/components/warehouse/ScanPhotoFailureNotice';
import AccountingSyncNotice from '@/components/warehouse/AccountingSyncNotice';
import BultoCreateFromScanPanel from '@/components/warehouse/BultoCreateFromScanPanel';
import AbsorbedBultosNotice from '@/components/warehouse/AbsorbedBultosNotice';
import AbsorbedBultosHistory from '@/components/warehouse/AbsorbedBultosHistory';
import ReprintDialog from '@/components/warehouse/ReprintDialog';
import useScannedPhotoUploader from '@/hooks/useScannedPhotoUploader';
import { Loader2, Save, Lock, Package, ScanLine, RotateCcw, CheckCircle2, Printer } from 'lucide-react';
import { toast } from 'sonner';

// Página standalone de escaneo de etiquetas de bultos para empleados.
// El empleado escanea el label_code, ve detalles básicos, ingresa el N° de contenedor
// CbmIngreso y guarda. El bulto queda order_locked=true (sin cambiar su status).
export default function BultoOrderScan({ user }) {
  const [scanValue, setScanValue] = useState('');
  const [bulto, setBulto] = useState(null);
  const [invoiceInfo, setInvoiceInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderNumbers, setOrderNumbers] = useState('');
  const [error, setError] = useState('');
  // Etiqueta escaneada que no existe en el sistema: se conserva el código y su foto
  // para crear el bulto en el momento, sin generar una etiqueta nueva.
  const [createState, setCreateState] = useState(null);
  // Código escaneado y estado de la foto que la cámara toma automáticamente.
  const [scannedCode, setScannedCode] = useState('');
  // Impresión de la etiqueta del bulto escaneado desde esta misma pantalla.
  const [showPrint, setShowPrint] = useState(false);
  const [photoErrors, setPhotoErrors] = useState([]);
  const [photoRetrying, setPhotoRetrying] = useState(false);
  // Avisos cuando el N° de contenedor del bulto no pudo aplicarse al recibo de contabilidad.
  const [syncWarnings, setSyncWarnings] = useState([]);
  // Bultos que este escaneo fusionó: su contenido pasó al bulto escaneado y esos bultos se
  // eliminaron (o quedaron registrados sin el paquete movido si eran de otro cliente).
  const [absorbedInfo, setAbsorbedInfo] = useState(null);
  const { handlePhotoCaptured, waitForPhoto, getPhotoStatus, retryPhoto } = useScannedPhotoUploader();
  // Mismo identificador persistente que usa la página del almacén de China.
  // Cuando no hay sesión, con él se audita quién asignó el N° de contenedor.
  const deviceIdRef = useRef('');

  useEffect(() => {
    try {
      let id = localStorage.getItem('bodega_device_id');
      if (!id) {
        id = (crypto?.randomUUID?.() || 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2));
        localStorage.setItem('bodega_device_id', id);
      }
      deviceIdRef.current = id;
    } catch (_) {}
  }, []);

  const reset = useCallback(() => {
    setBulto(null);
    setInvoiceInfo(null);
    setOrderNumbers('');
    setScanValue('');
    setError('');
    setCreateState(null);
    setScannedCode('');
    setPhotoErrors([]);
    setSyncWarnings([]);
    setAbsorbedInfo(null);
  }, []);

  const handleDetected = useCallback(async (code) => {
    const labelCode = String(code || '').trim();
    if (!labelCode) return;
    // Código con el que se capturó la foto del bulto.
    setScannedCode(labelCode);
    setLoading(true);
    setError('');
    setBulto(null);
    setInvoiceInfo(null);
    setOrderNumbers('');
    setCreateState(null);
    setSyncWarnings([]);

    let res = null;
    let found = null;
    let notFound = false;
    try {
      res = await base44.functions.invoke('getBultoByLabelCode', { label_code: labelCode });
      found = res?.data?.bulto || null;
      notFound = !found;
    } catch (e) {
      // 404 = la etiqueta todavía no existe en el sistema (no es un fallo de la pantalla).
      notFound = e?.response?.status === 404;
      if (!notFound) {
        setError('Error al buscar el bulto');
        toast.error('Error al buscar el bulto');
        setLoading(false);
        return;
      }
    }

    if (found) {
      setBulto(found);
      setInvoiceInfo({
        invoice_paid: res?.data?.invoice_paid,
        invoice_status: res?.data?.invoice_status,
        invoice_number: res?.data?.invoice_number,
      });
      // Si ya tiene contenedores asignados, precargarlos para mostrarlos (solo lectura si locked)
      const existing = Array.isArray(found.cbm_order_numbers) ? found.cbm_order_numbers : [];
      if (existing.length) setOrderNumbers(existing.join(', '));
      toast.success(`Bulto ${found.label_code} encontrado`);
      setLoading(false);
      return;
    }

    // Etiqueta no registrada: se conserva el código escaneado (y la foto capturada) y se
    // ofrece crear el bulto con esa misma etiqueta impresa, sin generar una nueva.
    try {
      const lookup = await base44.functions.invoke('bultoScanLookup', {
        action: 'label',
        label_code: labelCode,
        device_id: deviceIdRef.current,
      });
      setCreateState({
        label_code: labelCode,
        shipping_mark: lookup?.data?.shipping_mark || '',
        bulto_number: lookup?.data?.bulto_number || null,
        client: lookup?.data?.client || null,
      });
      toast.info('Etiqueta no registrada: puedes crear el bulto ahora');
    } catch (e) {
      setError('Bulto no encontrado');
      toast.error('Bulto no encontrado');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = async () => {
    if (!bulto) return;
    const parsed = orderNumbers.trim()
      ? orderNumbers.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (!parsed.length) {
      toast.error('Ingresa al menos un N° de contenedor');
      return;
    }
    // Foto tomada automáticamente al escanear la etiqueta: la asignación del N° de
    // contenedor NO se guarda hasta que esa foto termine de subir. Si falla, queda en rojo
    // con aviso y solo se puede reintentar la subida.
    const photoCode = scannedCode || bulto.label_code || '';
    let photoUrl = null;
    if (photoCode && getPhotoStatus(photoCode)) {
      setPhotoRetrying(true);
      photoUrl = await waitForPhoto(photoCode);
      setPhotoRetrying(false);
      if (!photoUrl) {
        setPhotoErrors([photoCode]);
        toast.error('No se pudo subir la foto del bulto');
        return;
      }
      setPhotoErrors([]);
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('assignBultoOrderNumbers', {
        bulto_id: bulto.id,
        cbm_order_numbers: parsed,
        device_id: deviceIdRef.current,
        recognition_photo_url: photoUrl || undefined,
      });
      if (res?.data?.error) {
        toast.error(res.data.error);
        return;
      }
      // El recibo de contabilidad se alinea con lo registrado aquí; si el N° de contenedor
      // ya lo usa otro recibo, se avisa sin bloquear el guardado del bulto.
      const warnings = res.data.sync?.warnings || [];
      setSyncWarnings(warnings);
      toast.success('N° de contenedor asignado y bulto bloqueado');
      if (warnings.length) toast.warning(warnings[0]);
      setBulto(res.data.bulto);
    } catch (e) {
      toast.error('Error al asignar el N° de contenedor');
    } finally {
      setSaving(false);
    }
  };

  const handleRetryPhoto = async () => {
    const pendingCode = photoErrors[0];
    if (!pendingCode) return;
    setPhotoRetrying(true);
    const url = await retryPhoto(pendingCode);
    setPhotoRetrying(false);
    if (!url) {
      toast.error('La foto sigue sin subir. Revisa tu conexión e intenta de nuevo.');
      return;
    }
    setPhotoErrors([]);
    await handleSave();
  };

  // El bulto se creó desde esta pantalla: se muestra ya bloqueado con su N° de contenedor.
  const handleCreated = useCallback((data) => {
    setBulto(data?.bulto || null);
    const warnings = data?.sync?.warnings || [];
    setSyncWarnings(warnings);
    if (warnings.length) toast.warning(warnings[0]);
    // El bulto escaneado fusionó el trabajo de uno o varios bultos viejos del almacén.
    setAbsorbedInfo(data?.absorbed || null);
    const absorbedBultos = data?.absorbed?.bultos || [];
    if (absorbedBultos.length) {
      const labels = absorbedBultos.map((b) => b.label_code).filter(Boolean).join(', ');
      toast.success(`Se fusionó ${labels ? `el bulto ${labels}` : 'el trabajo anterior'}`);
    }
    setInvoiceInfo({
      invoice_paid: data?.invoice_paid,
      invoice_status: data?.invoice_status,
      invoice_number: data?.invoice_number,
    });
    setCreateState(null);
  }, []);

  const isLocked = !!bulto?.order_locked;
  const isAdmin = user?.role === 'admin';
  // Empleado no puede editar si está locked. Admin sí puede (para corregir).
  const readOnly = isLocked && !isAdmin;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <ScanLine className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Asignar N° de Contenedor a Bulto</h1>
          <p className="text-sm text-slate-500">
            Escanea la etiqueta del bulto, ingresa el N° de contenedor CbmIngreso y guárdalo. El bulto queda bloqueado.
          </p>
        </div>
      </div>

      {!createState && (
        <BarcodeScannerModule
          title="Escanear etiqueta de bulto"
          description="Apunta la cámara al código QR (o al código de barras de las etiquetas viejas) o usa la lectora USB. La cámara toma una foto automática del bulto al leer la etiqueta."
          placeholder="Código de etiqueta (label_code)"
          actionLabel="Buscar bulto"
          cameraLabel="Usar cámara"
          autoStartCamera
          continuous={false}
          value={scanValue}
          onValueChange={setScanValue}
          onDetected={handleDetected}
          onPhotoCaptured={handlePhotoCaptured}
        />
      )}

      {photoErrors.length > 0 && (
        <ScanPhotoFailureNotice
          codes={photoErrors}
          retrying={photoRetrying}
          onRetry={handleRetryPhoto}
          description="El N° de contenedor no se guardó. Reintenta la subida de la foto para poder asignarlo."
        />
      )}

      {syncWarnings.length > 0 && <AccountingSyncNotice messages={syncWarnings} />}

      <AbsorbedBultosNotice absorbed={absorbedInfo} />

      {createState && !loading && (
        <BultoCreateFromScanPanel
          scannedCode={createState.label_code}
          shippingMark={createState.shipping_mark}
          bultoNumber={createState.bulto_number}
          candidateClient={createState.client}
          deviceId={deviceIdRef.current}
          photoApi={{ getPhotoStatus, waitForPhoto, retryPhoto }}
          onCancel={reset}
          onCreated={handleCreated}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Buscando bulto…
        </div>
      )}

      {error && !loading && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="pt-4 text-sm text-rose-700">{error}</CardContent>
        </Card>
      )}

      {bulto && !loading && !createState && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" /> Bulto {bulto.bulto_number}/{bulto.total_bultos}
              </span>
              {isLocked ? (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                  <Lock className="h-3 w-3 mr-1" /> N° de contenedor asignado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-600">Pendiente de contenedor</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Detalles básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Código de etiqueta</p>
                <p className="font-mono text-slate-800 break-all">{bulto.label_code}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Shipping Mark</p>
                <p className="font-mono text-slate-800">{bulto.shipping_mark}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Cliente</p>
                <p className="text-slate-800">{bulto.client_snapshot?.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-slate-800 break-all">{bulto.client_email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Paquetes</p>
                <p className="text-slate-800">{bulto.package_count || 0} paquete(s)</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Estado</p>
                <p className="text-slate-800 capitalize">{bulto.status?.replace('_', ' ')}</p>
              </div>
            </div>

            {/* Trackings */}
            {(bulto.package_trackings || []).length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Trackings contenidos</p>
                <div className="flex flex-wrap gap-1.5">
                  {(bulto.package_trackings || []).map((t, i) => (
                    <span key={i} className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded text-slate-700 break-all">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <AbsorbedBultosHistory entries={bulto.absorbed_bultos} />

            {/* Estado de factura */}
            {invoiceInfo && (
              <div className="text-xs text-slate-500 flex flex-wrap gap-3">
                <span>Factura: <span className="text-slate-700">{invoiceInfo.invoice_number || 'sin factura'}</span></span>
                <span>Estado: <span className={invoiceInfo.invoice_paid ? 'text-emerald-600' : 'text-amber-600'}>{invoiceInfo.invoice_status}</span></span>
              </div>
            )}

            {/* Impresión de la etiqueta del bulto escaneado */}
            <div className="pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setShowPrint(true)}>
                <Printer className="h-4 w-4" /> Imprimir etiqueta del bulto
              </Button>
            </div>

            {/* Campo de N° de contenedor */}
            <div className="pt-2 border-t border-border">
              {readOnly ? (
                <div className="space-y-2">
                  <Label className="text-xs">N° de contenedor asignado (solo lectura)</Label>
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-slate-700 font-mono break-all">
                    {(bulto.cbm_order_numbers || []).join(', ') || '—'}
                  </div>
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Este bulto ya fue asignado por {bulto.order_assigned_by || 'un empleado'}.
                    Solicita a un admin que lo desbloquee si necesitas corregirlo.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">N° de contenedor CbmIngreso</Label>
                  <Input
                    value={orderNumbers}
                    onChange={(e) => setOrderNumbers(e.target.value)}
                    placeholder="Ej: 12345 (separar con comas si son varias)"
                    inputMode="numeric"
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-400">
                    {isAdmin && isLocked
                      ? 'Este bulto ya tiene N° de contenedor asignado. Como admin puedes corregirlo o agregar otro contenedor: al guardar se reemplaza y queda registrado a tu usuario.'
                      : 'Ingresa el número de contenedor del almacén de China. Al guardar, el bulto queda bloqueado y no podrás editarlo nuevamente.'}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {isAdmin && isLocked ? 'Guardar cambios' : 'Guardar y bloquear'}
                    </Button>
                    <Button variant="outline" onClick={reset}>
                      <RotateCcw className="h-4 w-4" /> Escanear otro
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Admin puede desbloquear */}
            {isLocked && isAdmin && (
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const res = await base44.functions.invoke('updateBulto', {
                        bulto_id: bulto.id,
                        cbm_order_numbers: bulto.cbm_order_numbers || [],
                      });
                      if (res?.data?.error) { toast.error(res.data.error); return; }
                      // updateBulto no toca order_locked; usamos assignBultoOrderNumbers solo si está desbloqueado.
                      // Para desbloquear, hacemos un update directo vía SDK.
                      const unlocked = await base44.entities.Bulto.update(bulto.id, { order_locked: false });
                      setBulto(unlocked);
                      toast.success('Bulto desbloqueado. Ya puedes editar el N° de contenedor.');
                    } catch (e) {
                      toast.error('Error al desbloquear');
                    }
                  }}
                >
                  <Lock className="h-4 w-4" /> Desbloquear edición (admin)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!bulto && !loading && !error && !createState && (
        <div className="text-center text-sm text-slate-400 py-8 flex flex-col items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-slate-300" />
          Escanea una etiqueta de bulto para comenzar.
        </div>
      )}

      {bulto && (
        <ReprintDialog
          bulto={bulto}
          open={showPrint}
          onClose={() => setShowPrint(false)}
          deviceId={deviceIdRef.current}
          onRegistered={(updated) => {
            if (!updated) return;
            setBulto((prev) => (prev
              ? { ...prev, print_count: Number(updated.print_count || 0), reprint_unlocked: !!updated.reprint_unlocked }
              : prev));
          }}
        />
      )}
    </div>
  );
}