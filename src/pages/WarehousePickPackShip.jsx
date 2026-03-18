import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import PickingOrderList from '@/components/warehouse/PickingOrderList';
import PickingPackagesTable from '@/components/warehouse/PickingPackagesTable';
import useWarehouseAccess from '@/hooks/useWarehouseAccess';

export default function WarehousePickPackShip({ user }) {
  const [requests, setRequests] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [pickingData, setPickingData] = useState(null);
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [selectedPackageIds, setSelectedPackageIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [hasMoreRequests, setHasMoreRequests] = useState(false);
  const [loadingMoreRequests, setLoadingMoreRequests] = useState(false);
  const [packagesPage, setPackagesPage] = useState(1);
  const requestsPageSize = 20;
  const packagesPageSize = 25;
  const { allowed, loading: loadingAccess } = useWarehouseAccess(user, 'WarehousePickPackShip');

  const loadBaseData = async (append = false) => {
    try {
      if (append) setLoadingMoreRequests(true); else setLoading(true);
      const skip = append ? requests.length : 0;
      const [requestsData, locationsData] = await Promise.all([
        base44.entities.ConsolidationRequest.filter({ status: 'aprobada' }, '-approved_date', requestsPageSize, skip),
        base44.entities.WarehouseLocation.filter({ is_active: true }, 'code', 200)
      ]);
      setRequests((prev) => append ? [...prev, ...(requestsData || [])] : (requestsData || []));
      setHasMoreRequests((requestsData || []).length === requestsPageSize);
      if (!append) setLocations(locationsData || []);
    } catch {
      toast.error('No se pudo cargar la preparación de pedidos');
    }
    if (append) setLoadingMoreRequests(false); else setLoading(false);
  };

  const loadPicking = async (requestId) => {
    try {
      const response = await base44.functions.invoke('generatePickingList', { request_id: requestId });
      setPickingData(response?.data || null);
      setSelectedRequestId(requestId);
      setSelectedPackageIds([]);
      setPackagesPage(1);
    } catch {
      toast.error('No se pudo generar el picking list');
    }
  };

  useEffect(() => { loadBaseData(); }, []);

  const selectedCount = selectedPackageIds.length;
  const visiblePackages = useMemo(() => (pickingData?.packages || []).slice(0, packagesPage * packagesPageSize), [pickingData, packagesPage]);
  const selectedPackages = useMemo(() => (pickingData?.packages || []).filter((pkg) => selectedPackageIds.includes(pkg.id)), [pickingData, selectedPackageIds]);

  const handleScanPackage = (code) => {
    if (!pickingData?.packages?.length) {
      toast.error('Selecciona una solicitud primero');
      return;
    }

    const normalizedCode = code.trim().toLowerCase();
    const packageIndex = pickingData.packages.findIndex((pkg) => String(pkg.tracking_number || '').trim().toLowerCase() === normalizedCode);

    if (packageIndex === -1) {
      toast.error('Ese código no pertenece a la solicitud activa');
      return;
    }

    const matchedPackage = pickingData.packages[packageIndex];
    setPackagesPage((prev) => Math.max(prev, Math.ceil((packageIndex + 1) / packagesPageSize)));
    setSelectedPackageIds((prev) => prev.includes(matchedPackage.id) ? prev : [...prev, matchedPackage.id]);
    toast.success(`Paquete ${matchedPackage.tracking_number} seleccionado`);
  };

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

  if (loadingAccess) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (!allowed) {
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

      <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)] min-w-0">
        <div className="space-y-3">
          <PickingOrderList requests={requests} selectedRequestId={selectedRequestId} onSelect={loadPicking} />
          {hasMoreRequests && (
            <Button variant="outline" className="w-full" onClick={() => loadBaseData(true)} disabled={loadingMoreRequests}>
              {loadingMoreRequests ? 'Cargando...' : 'Cargar más solicitudes'}
            </Button>
          )}
        </div>

        <div className="space-y-4 min-w-0">
          {!pickingData ? (
            <Card><CardContent className="p-10 text-center text-slate-500">Selecciona una solicitud para ver su picking list.</CardContent></Card>
          ) : (
            <>
              <BarcodeScannerModule
                title="Escaneo rápido para picking"
                description="Escanea un tracking para marcarlo automáticamente dentro de la solicitud activa."
                placeholder="Escanea el tracking a preparar"
                actionLabel="Seleccionar paquete"
                onDetected={handleScanPackage}
              />

              <Card className="shadow-sm overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 min-w-0"><PackageCheck className="h-5 w-5 shrink-0" /> Resumen de preparación</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 min-w-0">
                  <div className="min-w-0"><p className="text-sm text-slate-500">Cliente</p><p className="font-medium text-slate-800 break-all">{pickingData.request.client_email}</p></div>
                  <div className="min-w-0"><p className="text-sm text-slate-500">Shipping mark</p><p className="font-medium text-slate-800 break-all">{pickingData.request.shipping_mark || '—'}</p></div>
                  <div><p className="text-sm text-slate-500">Paquetes</p><p className="font-medium text-slate-800">{pickingData.summary.package_count}</p></div>
                  <div><p className="text-sm text-slate-500">Ubicados</p><p className="font-medium text-slate-800">{pickingData.summary.located_count}</p></div>
                </CardContent>
              </Card>

              <Card className="shadow-sm overflow-hidden">
                <CardContent className="p-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">Mover seleccionados / confirmar packing</p>
                    <p className="text-sm text-slate-500">Seleccionados: {selectedCount}</p>
                  </div>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center min-w-0 xl:min-w-[520px]">
                    <Select value={destinationLocationId} onValueChange={setDestinationLocationId}>
                      <SelectTrigger className="w-full xl:w-72"><SelectValue placeholder="Ubicación destino" /></SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>{location.warehouse_name} · {location.code} · {location.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full xl:w-auto" variant="outline" disabled={processing || !selectedCount || !destinationLocationId} onClick={handleMoveSelected}>Mover seleccionados</Button>
                    <Button className="w-full xl:w-auto bg-blue-600 hover:bg-blue-700" disabled={processing || !destinationLocationId} onClick={handleConfirmPacking}>Confirmar packing</Button>
                  </div>
                </CardContent>
              </Card>

              <PickingPackagesTable
                packages={visiblePackages}
                selectedPackageIds={selectedPackageIds}
                onToggleAll={(checked) => setSelectedPackageIds(checked ? visiblePackages.map((pkg) => pkg.id) : [])}
                onToggleOne={(id, checked) => setSelectedPackageIds((prev) => checked ? [...prev, id] : prev.filter((item) => item !== id))}
              />
              {(pickingData.packages || []).length > visiblePackages.length && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setPackagesPage((prev) => prev + 1)}>Cargar más paquetes</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}