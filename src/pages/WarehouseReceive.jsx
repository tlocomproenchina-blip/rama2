import React, { useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Package, Search } from 'lucide-react';
import { toast } from 'sonner';
import ReceivePackagePanel from '@/components/warehouse/ReceivePackagePanel';

const emptyForm = {
  location_id: '',
  actual_weight_kg: '',
  actual_length_cm: '',
  actual_width_cm: '',
  actual_height_cm: '',
  reception_notes: '',
};

const canAccessWarehouse = (user) => user?.role === 'admin' || ['warehouse', 'operations_manager'].includes(user?.custom_role);

export default function WarehouseReceive({ user }) {
  const [tracking, setTracking] = useState('');
  const [pkg, setPkg] = useState(null);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suggestedLocation, setSuggestedLocation] = useState(null);

  useEffect(() => {
    (async () => {
      const data = await base44.entities.WarehouseLocation.filter({ is_active: true }, 'code', 200);
      setLocations(data || []);
      setLoadingLocations(false);
    })();
  }, []);

  const handleSearch = async () => {
    if (!tracking.trim()) return;
    try {
      setSearching(true);
      const found = await base44.entities.Package.filter({ tracking_number: tracking.trim() }, '-created_date', 1);
      const nextPkg = found?.[0] || null;
      setPkg(nextPkg);
      if (!nextPkg) {
        toast.error('No se encontró ese tracking');
        return;
      }
      setForm({
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
      const response = await base44.functions.invoke('findAvailableLocation', {});
      const best = response?.data?.best_match || null;
      setSuggestedLocation(best);
      if (best?.id) {
        setForm((prev) => ({ ...prev, location_id: best.id }));
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
    try {
      setSubmitting(true);
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
      setForm(emptyForm);
      setSuggestedLocation(null);
    } catch (error) {
      toast.error(error?.response?.data?.error || 'No se pudo recibir el paquete');
    }
    setSubmitting(false);
  };

  if (!canAccessWarehouse(user)) {
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

      {loadingLocations && <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}

      {pkg && !loadingLocations && (
        <ReceivePackagePanel
          pkg={pkg}
          form={form}
          setForm={setForm}
          locations={locations}
          suggestedLocation={suggestedLocation}
          onSuggest={handleSuggest}
          onSubmit={handleReceive}
          submitting={submitting}
        />
      )}
    </div>
  );
}