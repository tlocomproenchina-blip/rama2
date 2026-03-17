import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import PickingOrderList from '@/components/warehouse/PickingOrderList';
import PickingPackagesTable from '@/components/warehouse/PickingPackagesTable';

const canAccessWarehouse = (user) => user?.role === 'admin' || ['warehouse', 'operations_manager'].includes(user?.custom_role);

export default function WarehousePickPackShip({ user }) {
  const [requests, setRequests] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [pickingData, setPickingData] = useState(null);
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [selectedPackageIds, setSelectedPackageIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const loadBaseData = async () => {
    try {
      setLoading(true);
      const [requestsData, locationsData] = await Promise.all([
        base44.entities.ConsolidationRequest.filter({ status: 'aprobada' }, '-approved_date', 100),
        base44.entities.WarehouseLocation.filter({ is_active: true }, 'code', 200)
      ]);
      setRequests(requestsData || []);
      setLocations(locationsData || []);
    } catch {
      toast.error('No se pudo cargar la preparación de pedidos');
    }
    setLoading(false);
  };

  const loadPicking = async (requestId) => {
    try {
      const response = await base44.functions.invoke('generatePickingList', { request_id: requestId });
      setPickingData(response?.data || null);
      setSelectedRequestId(requestId);
      setSelectedPackageIds([]);
    } catch {
      toast.error('No se pudo generar el picking list');
    }
  };

  useEffect(() => { loadBaseData(); }, []);

  const selectedCount = selectedPackageIds.length;
  const selectedPackages = useMemo(() => (pickingData?.packages || []).filter((pkg) => selectedPackageIds.includes(pkg.id)), [pickingData, selectedPackageIds]);

  const handleMoveSelected = async () => {
    if (!destinationLocationId || !selectedPackages.length) return;
    try {
      setProcessing(true);
      await Promise.all(selectedPackages.map((pkg) => base44.functions.invoke('updatePackageLocationStatus', {
        package_id: pkg.id,
        target_location_id: destinationLocationId,
        movement_note: 'Movimiento desde módulo de picking'
      })));
      toast.success('Paquetes movidos');
      await loadPicking(selectedRequestId);
    } catch {
      toast.error('No se pudieron mover los paquetes');
    }
    setProcessing(false);
  };

  const handleConfirmPacking = async () => {
    if (!selectedRequestId) return;
    try {
      setProcessing(true);
      await base44.functions.invoke('confirmPacking', {
        request_id: selectedRequestId,
        target_location_id: destinationLocationId || undefined,
      });
      toast.success('Packing confirmado');
      await loadPicking(selectedRequestId);
    } catch {
      toast.error('No se pudo confirmar el packing');
    }
    setProcessing(false);
  };

  if (!canAccessWarehouse(user)) {
    return <Card><CardContent className="p-8 text-center text-slate-500">No tienes acceso a este módulo.</CardContent></Card>;
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Picking y packing</h1>
        <p className="text-slate-500">Organiza la preparación física de solicitudes aprobadas.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px,1fr]">
        <PickingOrderList requests={requests} selectedRequestId={selectedRequestId} onSelect={loadPicking} />

        <div className="space-y-4">
          {!pickingData ? (
            <Card><CardContent className="p-10 text-center text-slate-500">Selecciona una solicitud para ver su picking list.</CardContent></Card>
          ) : (
            <>
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><PackageCheck className="h-5 w-5" /> Resumen de preparación</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-4">
                  <div><p className="text-sm text-slate-500">Cliente</p><p className="font-medium text-slate-800">{pickingData.request.client_email}</p></div>
                  <div><p className="text-sm text-slate-500">Shipping mark</p><p className="font-medium text-slate-800">{pickingData.request.shipping_mark || '—'}</p></div>
                  <div><p className="text-sm text-slate-500">Paquetes</p><p className="font-medium text-slate-800">{pickingData.summary.package_count}</p></div>
                  <div><p className="text-sm text-slate-500">Ubicados</p><p className="font-medium text-slate-800">{pickingData.summary.located_count}</p></div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">Mover seleccionados / confirmar packing</p>
                    <p className="text-sm text-slate-500">Seleccionados: {selectedCount}</p>
                  </div>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <Select value={destinationLocationId} onValueChange={setDestinationLocationId}>
                      <SelectTrigger className="w-full lg:w-72"><SelectValue placeholder="Ubicación destino" /></SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>{location.code} · {location.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" disabled={processing || !selectedCount || !destinationLocationId} onClick={handleMoveSelected}>Mover seleccionados</Button>
                    <Button disabled={processing || !destinationLocationId} onClick={handleConfirmPacking} className="bg-blue-600 hover:bg-blue-700">Confirmar packing</Button>
                  </div>
                </CardContent>
              </Card>

              <PickingPackagesTable
                packages={pickingData.packages || []}
                selectedPackageIds={selectedPackageIds}
                onToggleAll={(checked) => setSelectedPackageIds(checked ? (pickingData.packages || []).map((pkg) => pkg.id) : [])}
                onToggleOne={(id, checked) => setSelectedPackageIds((prev) => checked ? [...prev, id] : prev.filter((item) => item !== id))}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}