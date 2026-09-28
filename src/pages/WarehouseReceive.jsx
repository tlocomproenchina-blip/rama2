import React, { useState, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Package, Search } from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import ReceivePackagePanel from '@/components/warehouse/ReceivePackagePanel';
import OrphanRegisterPanel from '@/components/warehouse/OrphanRegisterPanel';
import useWarehouseAccess from '@/hooks/useWarehouseAccess';
import useScannedPhotoUploader from '@/hooks/useScannedPhotoUploader';
import { getTrackingCandidates } from '@/lib/trackingNormalizer';
import { useOfflineEntityCache } from '@/hooks/useOfflineEntityCache';
import { useOfflineWriteQueue } from '@/hooks/useOfflineWriteQueue';
import OfflineSyncBadge from '@/components/warehouse/OfflineSyncBadge';
import { findPackageByTracking } from '@/lib/offlineDb';

const emptyForm = {
  location_id: '',
  actual_weight_kg: '',
  actual_length_cm: '',
  actual_width_cm: '',
  actual_height_cm: '',
  reception_notes: '',
};

export default function WarehouseReceive({ user }) {
  const [tracking, setTracking] = useState('');
  const [pkg, setPkg] = useState(null);
  const [form, setForm] = useState({ ...emptyForm, warehouse_id: '' });
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suggestedLocation, setSuggestedLocation] = useState(null);
  const [receiveFailed, setReceiveFailed] = useState(false);
  const [notFoundTracking, setNotFoundTracking] = useState(null);
  const { allowed, loading: loadingAccess } = useWarehouseAccess(user, 'WarehouseReceive');
  const { handlePhotoCaptured, waitForPhoto, getPhotoStatus, retryPhoto } = useScannedPhotoUploader();
  const lastScanCodeRef = useRef('');
  const [photoError, setPhotoError] = useState(false);
  const [photoRetrying, setPhotoRetrying] = useState(false);

  const { data: warehouses, loading: loadingWarehouses } = useOfflineEntityCache({
    storeName: 'warehouses',
    fetcher: () => base44.entities.Warehouse.filter({ is_active: true }, 'name', 100),
  });
  const { data: locations, loading: loadingLocations } = useOfflineEntityCache({
    storeName: 'warehouse_locations',
    fetcher: () => base44.entities.WarehouseLocation.filter({ is_active: true }, 'code', 200),
  });

  const { pending: pendingReceives, isOnline, isSyncing, enqueue: enqueueReceive } = useOfflineWriteQueue({
    queueType: 'receive',
    processor: async (item) => {
      const res = await base44.functions.invoke('assignPackageToLocation', item.payload);
      return res?.data || res;
    },
  });

  const handleSearch = async (rawTracking = tracking) => {
    const nextTracking = rawTracking.trim();
    if (!nextTracking) return;
    try {
      setSearching(true);
      setTracking(nextTracking);
      // 1. Buscar en cache local (instantáneo, sin red)
      const localPkg = await findPackageByTracking(nextTracking);
      if (localPkg) {
        setPkg(localPkg);
        setNotFoundTracking(null);
        setForm({
          warehouse_id: localPkg.warehouse_id || '',
          location_id: '',
          actual_weight_kg: localPkg.actual_weight_kg ?? '',
          actual_length_cm: localPkg.actual_length_cm ?? '',
          actual_width_cm: localPkg.actual_width_cm ?? '',
          actual_height_cm: localPkg.actual_height_cm ?? '',
          reception_notes: localPkg.reception_notes || '',
        });
        setSuggestedLocation(null);
        setSearching(false);
        return;
      }
      // 2. Si no está en cache y hay conexión, buscar en el servidor
      if (!navigator.onLine) {
        setPkg(null);
        setNotFoundTracking(nextTracking);
        setSearching(false);
        return;
      }
      const candidates = getTrackingCandidates(nextTracking);
      let nextPkg = null;
      let resolvedFromMaster = false;
      for (const candidate of candidates) {
        const found = await base44.entities.Package.filter({ tracking_number: candidate }, '-created_date', 1);
        if (found?.[0]) {
          nextPkg = found[0];
          if (candidate !== nextTracking) resolvedFromMaster = true;
          break;
        }
      }
      setPkg(nextPkg);
      if (!nextPkg) {
        setNotFoundTracking(nextTracking);
        return;
      }
      if (resolvedFromMaster) {
        toast.info(`Tracking master resuelto: ${nextPkg.tracking_number}`);
      }
      setNotFoundTracking(null);
      setForm({
        warehouse_id: nextPkg.warehouse_id || '',
        location_id: '',
        actual_weight_kg: nextPkg.actual_weight_kg ?? '',
        actual_length_cm: nextPkg.actual_length_cm ?? '',
        actual_width_cm: nextPkg.actual_width_cm ?? '',
        actual_height_cm: nextPkg.actual_height_cm ?? '',
        reception_notes: nextPkg.reception_notes || '',
      });
      setSuggestedLocation(null);
    } catch {
      toast.error('No se pudo buscar el paquete');
    }
    setSearching(false);
  };

  const handleSuggest = async () => {
    try {
      const response = await base44.functions.invoke('findAvailableLocation', { warehouse_id: form.warehouse_id || undefined });
      const best = response?.data?.best_match || null;
      setSuggestedLocation(best);
      if (best?.id) {
        setForm((prev) => ({ ...prev, warehouse_id: best.warehouse_id || prev.warehouse_id, location_id: best.id }));
        toast.success('Ubicación sugerida aplicada');
      } else {
        toast.error('No hay ubicaciones disponibles');
      }
    } catch {
      toast.error('No se pudo sugerir una ubicación');
    }
  };

  // Código con el que se capturó la foto: el escáner puede leer un sub-tracking
  // distinto al tracking master del paquete.
  const photoCodeFor = (target) => lastScanCodeRef.current || target?.tracking_number || '';

  const handleReceive = async ({ skipPhoto = false } = {}) => {
    if (!pkg?.id || !form.location_id) return;
    const previousPkg = pkg;
    const selectedLocation = locations.find((location) => location.id === form.location_id);
    try {
      setSubmitting(true);
      setReceiveFailed(false);
      setPkg((currentPkg) => currentPkg ? {
        ...currentPkg,
        status: 'recibido',
        warehouse_id: form.warehouse_id,
        warehouse_location_id: form.location_id,
        warehouse_location_code: selectedLocation?.code || currentPkg.warehouse_location_code,
        warehouse_location_name: selectedLocation?.name || currentPkg.warehouse_location_name,
        reception_notes: form.reception_notes,
      } : currentPkg);
      // Foto del escaneo: se espera el resultado real de la subida antes de guardar.
      // Si la subida falla, el paquete NO se guarda sin foto: se marca en rojo y se
      // ofrece reintentar la foto o confirmar el recibido sin foto.
      let photoUrl = null;
      const photoCode = photoCodeFor(pkg);
      if (skipPhoto) {
        photoUrl = null;
      } else if (!navigator.onLine) {
        if (getPhotoStatus(photoCode)) toast.info('Sin conexión: el paquete se recibirá sin foto');
      } else if (photoCode) {
        const photoStatus = getPhotoStatus(photoCode);
        if (photoStatus === 'uploading' || photoStatus === 'ready') {
          setPhotoRetrying(true);
          photoUrl = await waitForPhoto(photoCode);
          setPhotoRetrying(false);
        }
        if (!photoUrl && getPhotoStatus(photoCode) === 'failed') {
          setPhotoError(true);
          setPkg(previousPkg);
          toast.error('No se pudo subir la foto del paquete');
          setSubmitting(false);
          return;
        }
      }
      const assignPayload = {
        package_id: pkg.id,
        location_id: form.location_id,
        actual_weight_kg: form.actual_weight_kg,
        actual_length_cm: form.actual_length_cm,
        actual_width_cm: form.actual_width_cm,
        actual_height_cm: form.actual_height_cm,
        reception_notes: form.reception_notes,
        mark_received: true,
      };
      if (photoUrl) {
        assignPayload.package_image_url = photoUrl;
        assignPayload.package_image_urls = [photoUrl];
      }
      // Si hay conexión, enviar directo; si no, encolar para sync diferida
      if (navigator.onLine) {
        await base44.functions.invoke('assignPackageToLocation', assignPayload);
        toast.success('Paquete recibido y ubicado');
      } else {
        await enqueueReceive({ payload: assignPayload });
        toast.info('Paquete recibido offline — se sincronizará al recuperar conexión');
      }
      setPhotoError(false);
      lastScanCodeRef.current = '';
      setTracking('');
      setPkg(null);
      setForm({ ...emptyForm, warehouse_id: '' });
      setSuggestedLocation(null);
    } catch (error) {
      setPkg(previousPkg);
      setReceiveFailed(true);
      toast.error(error?.response?.data?.error || 'No se pudo recibir el paquete');
    }
    setSubmitting(false);
  };

  const handleRetryPhoto = async () => {
    const code = photoCodeFor(pkg);
    if (!code) return;
    setPhotoRetrying(true);
    const url = await retryPhoto(code);
    setPhotoRetrying(false);
    if (url) {
      setPhotoError(false);
      await handleReceive();
    } else {
      toast.error('La foto sigue sin subir. Revisa tu conexión e intenta de nuevo.');
    }
  };

  const handleConfirmSkipPhoto = () => {
    setPhotoError(false);
    handleReceive({ skipPhoto: true });
  };

  if (loadingAccess) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (!allowed) {
    return <Card><CardContent className="p-8 text-center text-slate-500">No tienes acceso a este módulo.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Recepción de mercancía</h1>
          <p className="text-slate-500">Busca el tracking, confirma medidas y asigna ubicación.</p>
        </div>
        <OfflineSyncBadge pendingCount={pendingReceives.length} isOnline={isOnline} isSyncing={isSyncing} onRetry={() => {}} />
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Buscar paquete</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row">
          <Input placeholder="Ingresa tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
          <Button onClick={handleSearch} disabled={searching || loadingLocations} className="bg-blue-600 hover:bg-blue-700">
            {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />} Buscar
          </Button>
        </CardContent>
      </Card>

      <BarcodeScannerModule
        title="Escaneo rápido de recepción"
        description="Busca un tracking usando la cámara del dispositivo o una lectora de códigos de barras. La cámara captura una foto automática del paquete al detectar el código."
        placeholder="Escanea el tracking del paquete"
        actionLabel="Buscar tracking"
        onDetected={(code) => { lastScanCodeRef.current = code; handleSearch(code); }}
        onPhotoCaptured={handlePhotoCaptured}
      />

      {loadingLocations && <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}

      {pkg && !loadingLocations && (
        <ReceivePackagePanel
          pkg={pkg}
          form={form}
          setForm={setForm}
          warehouses={warehouses}
          locations={locations.filter((location) => !form.warehouse_id || location.warehouse_id === form.warehouse_id)}
          suggestedLocation={suggestedLocation}
          onSuggest={handleSuggest}
          onSubmit={handleReceive}
          submitting={submitting}
          failed={receiveFailed}
          photoError={photoError}
          photoRetrying={photoRetrying}
          onRetryPhoto={handleRetryPhoto}
          onConfirmSkipPhoto={handleConfirmSkipPhoto}
        />
      )}

      {notFoundTracking && !loadingLocations && (
        <OrphanRegisterPanel
          tracking={notFoundTracking}
          warehouses={warehouses}
          locations={locations}
          suggestedLocation={suggestedLocation}
          onSuggest={handleSuggest}
          onDone={() => {
            setNotFoundTracking(null);
            setTracking('');
            setForm({ ...emptyForm, warehouse_id: '' });
            setSuggestedLocation(null);
          }}
        />
      )}
    </div>
  );
}