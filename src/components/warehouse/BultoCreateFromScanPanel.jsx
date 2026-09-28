import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import ScanPhotoFailureNotice from '@/components/warehouse/ScanPhotoFailureNotice';
import ScanClientPicker from '@/components/warehouse/ScanClientPicker';
import { AlertTriangle, Camera, Loader2, Package, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Registro del bulto cuando la etiqueta escaneada no existe en el sistema.
// Conserva el código impreso (no se genera etiqueta ni número nuevo): confirma el
// cliente deducido del shipping mark, acumula los paquetes escaneados y guarda el
// bulto junto con el N° de orden y la foto capturada al escanear la etiqueta.
export default function BultoCreateFromScanPanel({
  scannedCode, shippingMark, bultoNumber, candidateClient, deviceId, photoApi, onCancel, onCreated,
}) {
  const [client, setClient] = useState(candidateClient || null);
  const [packages, setPackages] = useState([]);
  const [pkgCode, setPkgCode] = useState('');
  const [adding, setAdding] = useState(false);
  // Código escaneado que no existe en el sistema: se pide confirmación antes de
  // agregarlo al bulto como "sin registrar".
  const [pendingCode, setPendingCode] = useState('');
  const [packageError, setPackageError] = useState('');
  const [orderNumbers, setOrderNumbers] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoErrors, setPhotoErrors] = useState([]);
  const [photoRetrying, setPhotoRetrying] = useState(false);

  const photoStatus = photoApi?.getPhotoStatus?.(scannedCode) || null;

  const handleAddPackage = async (code) => {
    const value = String(code || '').trim();
    if (!value) return;
    if (!client) {
      toast.error('Confirma primero el cliente del bulto');
      return;
    }
    const already = packages.some((p) => p.code === value || p.tracking_number === value || (p.label_code && p.label_code === value));
    if (already) {
      toast.error('Ese paquete ya está en la lista');
      setPkgCode('');
      return;
    }
    setAdding(true);
    setPackageError('');
    setPendingCode('');
    try {
      const res = await base44.functions.invoke('bultoScanLookup', {
        action: 'package',
        code: value,
        client_email: client.email,
        device_id: deviceId,
      });
      const data = res?.data || {};
      if (data.error) {
        setPackageError(data.error);
        toast.error(data.error);
        return;
      }
      if (data.not_registered) {
        // No existe como paquete en el sistema: se ofrece agregarlo igual.
        setPendingCode(value);
        toast.info(`El paquete ${value} no está registrado en el sistema`);
        return;
      }
      const pkg = data.package;
      setPackages((prev) => [...prev, { ...pkg, code: value }]);
      setPkgCode('');
      toast.success(`Paquete agregado: ${pkg.tracking_number || value}`);
    } catch (e) {
      setPackageError('Error al validar el paquete');
      toast.error('Error al validar el paquete');
    } finally {
      setAdding(false);
    }
  };

  // Agrega el código no registrado a la lista del bulto: no crea ni modifica
  // paquetes en la base de datos, solo cuenta como uno más del bulto.
  const confirmAddUnregistered = () => {
    const value = pendingCode.trim();
    if (!value) return;
    setPackages((prev) => [...prev, { code: value, tracking_number: value, unregistered: true }]);
    setPendingCode('');
    setPkgCode('');
    setPackageError('');
    toast.success(`Paquete agregado sin registrar: ${value}`);
  };

  const handleSave = async () => {
    if (!client) {
      toast.error('Confirma el cliente del bulto');
      return;
    }
    if (!packages.length) {
      toast.error('Escanea al menos un paquete');
      return;
    }
    const parsed = orderNumbers.trim() ? orderNumbers.split(',').map((s) => s.trim()).filter(Boolean) : [];
    if (!parsed.length) {
      toast.error('Ingresa al menos un N° de orden');
      return;
    }

    // La foto capturada al escanear la etiqueta es obligatoria: el bulto no se guarda
    // hasta que termine de subir, igual que en la asignación normal del N° de orden.
    let photoUrl = null;
    if (photoStatus) {
      setPhotoRetrying(true);
      photoUrl = await photoApi.waitForPhoto(scannedCode);
      setPhotoRetrying(false);
      if (!photoUrl) {
        setPhotoErrors([scannedCode]);
        toast.error('No se pudo subir la foto del bulto');
        return;
      }
      setPhotoErrors([]);
    }

    setSaving(true);
    setError('');
    try {
      const res = await base44.functions.invoke('createBultoFromScan', {
        label_code: scannedCode,
        client_email: client.email,
        package_codes: packages.map((p) => p.code),
        unregistered_codes: packages.filter((p) => p.unregistered).map((p) => p.code),
        cbm_order_numbers: parsed,
        device_id: deviceId,
        recognition_photo_url: photoUrl || undefined,
      });
      if (res?.data?.error) {
        setError(res.data.error);
        toast.error(res.data.error);
        return;
      }
      toast.success('Bulto creado con su N° de orden');
      onCreated?.(res.data);
    } catch (e) {
      setError('Error al crear el bulto');
      toast.error('Error al crear el bulto');
    } finally {
      setSaving(false);
    }
  };

  const handleRetryPhoto = async () => {
    const pendingCode = photoErrors[0];
    if (!pendingCode) return;
    setPhotoRetrying(true);
    const url = await photoApi.retryPhoto(pendingCode);
    setPhotoRetrying(false);
    if (!url) {
      toast.error('La foto sigue sin subir. Revisa tu conexión e intenta de nuevo.');
      return;
    }
    setPhotoErrors([]);
    await handleSave();
  };

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-amber-800">
            <AlertTriangle className="h-4 w-4" /> Etiqueta no registrada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-amber-800">
            Este código no existe en el sistema. Confirma los datos y crea el bulto con la misma etiqueta impresa.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-amber-700">Código escaneado</p>
              <p className="font-mono text-lg font-semibold text-slate-800 break-all">{scannedCode}</p>
            </div>
            <div>
              <p className="text-xs text-amber-700">Shipping mark del código</p>
              <p className="font-mono text-slate-800 break-all">{shippingMark || '—'}</p>
              <p className="text-xs text-slate-500">{bultoNumber ? `Bulto N° ${bultoNumber} según el código` : 'El código no trae número de bulto'}</p>
            </div>
          </div>
          <p className="text-xs text-amber-700 flex items-center gap-1">
            <Camera className="h-3.5 w-3.5" />
            {photoStatus === 'ready' && 'Foto del bulto capturada y subida.'}
            {photoStatus === 'uploading' && 'Subiendo la foto del bulto…'}
            {photoStatus === 'failed' && 'La foto del bulto no subió: se reintentará al guardar.'}
            {!photoStatus && 'Sin foto de cámara: se guardará solo con el código escaneado.'}
          </p>
        </CardContent>
      </Card>

      <ScanClientPicker
        candidateClient={candidateClient}
        selectedClient={client}
        deviceId={deviceId}
        onSelect={setClient}
      />

      {client && (
        <>
          <BarcodeScannerModule
            title="Escanear paquetes del bulto"
            description="Escanea la etiqueta o el tracking de cada paquete que va dentro de este bulto."
            placeholder="Etiqueta o tracking del paquete"
            actionLabel="Agregar paquete"
            cameraLabel="Usar cámara"
            continuous
            value={pkgCode}
            onValueChange={setPkgCode}
            onDetected={handleAddPackage}
          />

          {adding && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando paquete…
            </div>
          )}

          {pendingCode && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    El paquete <span className="font-mono font-semibold break-all">{pendingCode}</span> no está
                    registrado en el sistema. Puedes agregarlo igual al bulto: quedará marcado como
                    {' '}"sin registrar" y no se crea ningún paquete nuevo.
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={confirmAddUnregistered} disabled={adding} className="bg-blue-600 hover:bg-blue-700">
                    <Package className="h-4 w-4" /> Agregar igual
                  </Button>
                  <Button variant="outline" onClick={() => { setPendingCode(''); setPkgCode(''); }} disabled={adding}>
                    Descartar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {packageError && (
            <Card className="border-rose-200 bg-rose-50">
              <CardContent className="pt-4 text-sm text-rose-700 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {packageError}
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-2 flex-wrap text-base">
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4" /> Paquetes del bulto
                </span>
                <Badge variant="outline" className="text-slate-600">{packages.length} paquete(s)</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {packages.length === 0 ? (
                <p className="text-sm text-slate-400">Todavía no has agregado paquetes.</p>
              ) : (
                packages.map((p) => (
                  <div key={p.id || p.code} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-slate-800 break-all">{p.tracking_number || p.code}</p>
                      {p.description && <p className="text-xs text-slate-500 break-words">{p.description}</p>}
                      {p.unregistered && (
                        <Badge variant="outline" className="mt-1 border-amber-300 text-[10px] text-amber-700">
                          sin registrar
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-rose-600 hover:text-rose-700"
                      onClick={() => setPackages((prev) => prev.filter((x) => (x.id || x.code) !== (p.id || p.code)))}
                    >
                      <Trash2 className="h-4 w-4" /> Quitar
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {photoErrors.length > 0 && (
            <ScanPhotoFailureNotice
              codes={photoErrors}
              retrying={photoRetrying}
              onRetry={handleRetryPhoto}
              description="El bulto no se creó. Reintenta la subida de la foto para poder crearlo."
            />
          )}

          <Card className="shadow-sm">
            <CardContent className="pt-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">N° de orden CbmIngreso</Label>
                <Input
                  value={orderNumbers}
                  onChange={(e) => setOrderNumbers(e.target.value)}
                  placeholder="Ej: 12345 (separar con comas si son varias)"
                  inputMode="numeric"
                />
                <p className="text-[10px] text-slate-400">
                  Al guardar, el bulto queda bloqueado con su N° de orden y los paquetes marcados como reconocidos en Venezuela.
                </p>
              </div>

              {error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={handleSave} disabled={saving || !packages.length} className="bg-blue-600 hover:bg-blue-700">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Crear bulto y asignar N° de orden
                </Button>
                <Button variant="outline" onClick={onCancel} disabled={saving}>
                  <RotateCcw className="h-4 w-4" /> Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}