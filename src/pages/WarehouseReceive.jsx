import React, { useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Package, Search } from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import ReceivePackagePanel from '@/components/warehouse/ReceivePackagePanel';
import useWarehouseAccess from '@/hooks/useWarehouseAccess';

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
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ ...emptyForm, warehouse_id: '' });
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suggestedLocation, setSuggestedLocation] = useState(null);
  const [receiveFailed, setReceiveFailed] = useState(false);
  const { allowed, loading: loadingAccess } = useWarehouseAccess(user, 'WarehouseReceive');

  useEffect(() => {
    (async () => {
      try {
        const [warehousesData, locationsData] = await Promise.all([
          base44.entities.Warehouse.filter({ is_active: true }, 'name', 100),
          base44.entities.WarehouseLocation.filter({ is_active: true }, 'code', 200)
        ]);
        setWarehouses(warehousesData || []);
        setLocations(locationsData || []);
      } catch {
        toast.error('No se pudieron cargar las ubicaciones');
      }
      setLoadingLocations(false);
    })();
  }, []);

  const handleSearch = async (rawTracking = tracking) => {
    const nextTracking = rawTracking.trim();
    if (!nextTracking) return;
    try {
      setSearching(true);
      setTracking(nextTracking);
      const found = await base44.entities.Package.filter({ tracking_number: nextTracking }, '-created_date', 1);
      const nextPkg = found?.[0] || null;
      setPkg(nextPkg);
      if (!nextPkg) {
        toast.error('No se encontró ese tracking');
        return;
      }
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

  const handleReceive = async () => {
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
      await base44.functions.invoke('assignPackageToLocation', {
        package_id: pkg.id,
        location_id: form.location_id,
        actual_weight_kg: form.actual_weight_kg,
        actual_length_cm: form.actual_length_cm,
        actual_width_cm: form.actual_width_cm,
        actual_height_cm: form.actual_height_cm,
        reception_notes: form.reception_notes,
        mark_received: true,
      });
      toast.success('Paquete recibido y ubicado');
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

  if (loadingAccess) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (!allowed) {
    return <Card><CardContent className="p-8 text-center text-slate-500">No tienes acceso a este módulo.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Recepción de mercancía</h1>
        <p className="text-slate-500">Busca el tracking, confirma medidas y asigna ubicación.</p>
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
        description="Busca un tracking usando la cámara del dispositivo o una lectora de códigos de barras."
        placeholder="Escanea el tracking del paquete"
        actionLabel="Buscar tracking"
        onDetected={(code) => handleSearch(code)}
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
        />
      )}
    </div>
  );
}