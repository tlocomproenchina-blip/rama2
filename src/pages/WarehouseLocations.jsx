import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Layers, Plus, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import WarehouseLocationForm from '@/components/warehouse/WarehouseLocationForm';
import WarehouseLocationList from '@/components/warehouse/WarehouseLocationList';
import WarehouseForm from '@/components/warehouse/WarehouseForm';
import WarehouseList from '@/components/warehouse/WarehouseList';
import useWarehouseAccess from '@/hooks/useWarehouseAccess';
import { useOfflineWriteQueue } from '@/hooks/useOfflineWriteQueue';
import OfflineSyncBadge from '@/components/warehouse/OfflineSyncBadge';
import { getAll, bulkPut, clearStore } from '@/lib/offlineDb';

export default function WarehouseLocations({ user }) {
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingLocationIds, setPendingLocationIds] = useState({});
  const [failedLocationIds, setFailedLocationIds] = useState({});
  const [pendingDeleteLocationIds, setPendingDeleteLocationIds] = useState({});
  const [pendingWarehouseIds, setPendingWarehouseIds] = useState({});
  const [failedWarehouseIds, setFailedWarehouseIds] = useState({});
  const [pendingDeleteWarehouseIds, setPendingDeleteWarehouseIds] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 24;
  const { allowed, loading: loadingAccess } = useWarehouseAccess(user, 'WarehouseLocations');

  const { pending: pendingOps, isOnline, isSyncing, enqueue: enqueueOp } = useOfflineWriteQueue({
    queueType: 'warehouse_mgmt',
    processor: async (item) => {
      const fnMap = {
        create_location: 'createWarehouseLocation',
        update_location: 'updateWarehouseLocation',
        delete_location: 'deleteWarehouseLocation',
        create_warehouse: 'createWarehouse',
        update_warehouse: 'updateWarehouse',
        delete_warehouse: 'deleteWarehouse',
      };
      await base44.functions.invoke(fnMap[item.operation], item.payload);
    },
  });

  const loadLocations = async (append = false) => {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      const skip = append ? locations.length : 0;
      // En carga inicial, servir del cache primero
      if (!append) {
        const [cachedWh, cachedLoc] = await Promise.all([
          getAll('warehouses'),
          getAll('warehouse_locations'),
        ]);
        if (cachedWh.length > 0) setWarehouses(cachedWh);
        if (cachedLoc.length > 0) {
          setLocations(cachedLoc);
          setLoading(false);
        }
      }
      if (!navigator.onLine && !append) return;
      const [warehousesData, locationsData] = await Promise.all([
        base44.entities.Warehouse.list('name', 200),
        base44.entities.WarehouseLocation.list('code', pageSize, skip)
      ]);
      setWarehouses(warehousesData || []);
      setLocations((prev) => append ? [...prev, ...(locationsData || [])] : (locationsData || []));
      setHasMore((locationsData || []).length === pageSize);
      if (!append) {
        await clearStore('warehouses');
        await bulkPut('warehouses', warehousesData || []);
        await clearStore('warehouse_locations');
        await bulkPut('warehouse_locations', locationsData || []);
      }
    } catch {
      toast.error('No se pudieron cargar las ubicaciones');
    }
    if (append) setLoadingMore(false); else setLoading(false);
  };

  useEffect(() => { loadLocations(); }, []);

  const filteredLocations = useMemo(() => locations.filter((location) => {
    const matchesSearch = !search || [location.name, location.code, location.notes, location.warehouse_name, location.warehouse_city, location.warehouse_country].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()));
    const matchesWarehouse = warehouseFilter === 'all' || location.warehouse_id === warehouseFilter;
    const matchesZone = zoneFilter === 'all' || location.zone === zoneFilter;
    const matchesActive = activeFilter === 'all' || (activeFilter === 'active' ? location.is_active !== false : location.is_active === false);
    return matchesSearch && matchesWarehouse && matchesZone && matchesActive;
  }), [locations, search, warehouseFilter, zoneFilter, activeFilter]);

  const handleSave = async (payload) => {
    const warehouseMeta = warehouses.find((warehouse) => warehouse.id === payload.warehouse_id);
    const optimisticLocation = {
      ...(editingLocation || {}),
      ...payload,
      warehouse_name: warehouseMeta?.name || editingLocation?.warehouse_name,
      warehouse_city: warehouseMeta?.city || editingLocation?.warehouse_city,
      warehouse_country: warehouseMeta?.country || editingLocation?.warehouse_country,
    };

    try {
      setSaving(true);
      setModalOpen(false);
      setEditingLocation(null);

      if (editingLocation) {
        const previousLocations = locations;
        setLocations((prev) => prev.map((location) => location.id === editingLocation.id ? { ...location, ...optimisticLocation } : location));
        setPendingLocationIds((prev) => ({ ...prev, [editingLocation.id]: true }));
        setFailedLocationIds((prev) => ({ ...prev, [editingLocation.id]: false }));
        try {
          if (navigator.onLine) {
            await base44.functions.invoke('updateWarehouseLocation', { location_id: editingLocation.id, ...payload });
            toast.success('Ubicación actualizada');
          } else {
            await enqueueOp({ operation: 'update_location', payload: { location_id: editingLocation.id, ...payload } });
            toast.info('Ubicación actualizada offline — se sincronizará al recuperar conexión');
          }
        } catch (error) {
          setLocations(previousLocations);
          setFailedLocationIds((prev) => ({ ...prev, [editingLocation.id]: true }));
          toast.error(error?.response?.data?.error || 'No se pudo guardar la ubicación');
        } finally {
          setPendingLocationIds((prev) => ({ ...prev, [editingLocation.id]: false }));
        }
      } else {
        const tempId = `temp-location-${Date.now()}`;
        setLocations((prev) => [{ id: tempId, ...optimisticLocation }, ...prev]);
        setPendingLocationIds((prev) => ({ ...prev, [tempId]: true }));
        try {
          if (navigator.onLine) {
            await base44.functions.invoke('createWarehouseLocation', payload);
            toast.success('Ubicación creada');
            await loadLocations();
          } else {
            await enqueueOp({ operation: 'create_location', payload });
            toast.info('Ubicación creada offline — se sincronizará al recuperar conexión');
          }
        } catch (error) {
          setLocations((prev) => prev.filter((location) => location.id !== tempId));
          toast.error(error?.response?.data?.error || 'No se pudo guardar la ubicación');
        } finally {
          setPendingLocationIds((prev) => ({ ...prev, [tempId]: false }));
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (location) => {
    if (!window.confirm(`¿Eliminar ${location.name}?`)) return;
    try {
      setPendingDeleteLocationIds((prev) => ({ ...prev, [location.id]: true }));
      setFailedLocationIds((prev) => ({ ...prev, [location.id]: false }));
      if (navigator.onLine) {
        await base44.functions.invoke('deleteWarehouseLocation', { location_id: location.id });
      } else {
        await enqueueOp({ operation: 'delete_location', payload: { location_id: location.id } });
      }
      setLocations((prev) => prev.filter((item) => item.id !== location.id));
      toast.success('Ubicación eliminada');
    } catch (error) {
      setFailedLocationIds((prev) => ({ ...prev, [location.id]: true }));
      toast.error(error?.response?.data?.error || 'No se pudo eliminar la ubicación');
    } finally {
      setPendingDeleteLocationIds((prev) => ({ ...prev, [location.id]: false }));
    }
  };

  const handleSaveWarehouse = async (payload) => {
    try {
      setSaving(true);
      setWarehouseModalOpen(false);
      setEditingWarehouse(null);

      if (editingWarehouse) {
        const previousWarehouses = warehouses;
        setWarehouses((prev) => prev.map((warehouse) => warehouse.id === editingWarehouse.id ? { ...warehouse, ...payload } : warehouse));
        setPendingWarehouseIds((prev) => ({ ...prev, [editingWarehouse.id]: true }));
        setFailedWarehouseIds((prev) => ({ ...prev, [editingWarehouse.id]: false }));
        try {
          if (navigator.onLine) {
            await base44.functions.invoke('updateWarehouse', { warehouse_id: editingWarehouse.id, ...payload });
            toast.success('Almacén actualizado');
          } else {
            await enqueueOp({ operation: 'update_warehouse', payload: { warehouse_id: editingWarehouse.id, ...payload } });
            toast.info('Almacén actualizado offline — se sincronizará al recuperar conexión');
          }
        } catch (error) {
          setWarehouses(previousWarehouses);
          setFailedWarehouseIds((prev) => ({ ...prev, [editingWarehouse.id]: true }));
          toast.error(error?.response?.data?.error || 'No se pudo guardar el almacén');
        } finally {
          setPendingWarehouseIds((prev) => ({ ...prev, [editingWarehouse.id]: false }));
        }
      } else {
        const tempId = `temp-warehouse-${Date.now()}`;
        setWarehouses((prev) => [{ id: tempId, ...payload }, ...prev]);
        setPendingWarehouseIds((prev) => ({ ...prev, [tempId]: true }));
        try {
          if (navigator.onLine) {
            await base44.functions.invoke('createWarehouse', payload);
            toast.success('Almacén creado');
            await loadLocations();
          } else {
            await enqueueOp({ operation: 'create_warehouse', payload });
            toast.info('Almacén creado offline — se sincronizará al recuperar conexión');
          }
        } catch (error) {
          setWarehouses((prev) => prev.filter((warehouse) => warehouse.id !== tempId));
          toast.error(error?.response?.data?.error || 'No se pudo guardar el almacén');
        } finally {
          setPendingWarehouseIds((prev) => ({ ...prev, [tempId]: false }));
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWarehouse = async (warehouse) => {
    if (!window.confirm(`¿Eliminar ${warehouse.name}?`)) return;
    try {
      setPendingDeleteWarehouseIds((prev) => ({ ...prev, [warehouse.id]: true }));
      setFailedWarehouseIds((prev) => ({ ...prev, [warehouse.id]: false }));
      if (navigator.onLine) {
        await base44.functions.invoke('deleteWarehouse', { warehouse_id: warehouse.id });
      } else {
        await enqueueOp({ operation: 'delete_warehouse', payload: { warehouse_id: warehouse.id } });
      }
      setWarehouses((prev) => prev.filter((item) => item.id !== warehouse.id));
      toast.success('Almacén eliminado');
    } catch (error) {
      setFailedWarehouseIds((prev) => ({ ...prev, [warehouse.id]: true }));
      toast.error(error?.response?.data?.error || 'No se pudo eliminar el almacén');
    } finally {
      setPendingDeleteWarehouseIds((prev) => ({ ...prev, [warehouse.id]: false }));
    }
  };

  if (loadingAccess) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (!allowed) {
    return <Card><CardContent className="p-8 text-center text-slate-500">No tienes acceso a este módulo.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Ubicaciones de almacén</h1>
          <p className="text-slate-500">Administra sedes, ciudades, países y espacios físicos.</p>
        </div>
        <OfflineSyncBadge pendingCount={pendingOps.length} isOnline={isOnline} isSyncing={isSyncing} onRetry={() => {}} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setEditingWarehouse(null); setWarehouseModalOpen(true); }}>
            <Building2 className="h-4 w-4 mr-2" /> Nuevo almacén
          </Button>
          <Button onClick={() => { setEditingLocation(null); setModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" /> Nueva ubicación
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Almacenes / sedes</CardTitle>
        </CardHeader>
        <CardContent>
          <WarehouseList
            warehouses={warehouses}
            pendingIds={pendingWarehouseIds}
            failedIds={failedWarehouseIds}
            pendingDeleteIds={pendingDeleteWarehouseIds}
            onEdit={(warehouse) => { setEditingWarehouse(warehouse); setWarehouseModalOpen(true); }}
            onDelete={handleDeleteWarehouse}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Buscar por nombre, código, ciudad o país" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger><SelectValue placeholder="Almacén" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los almacenes</SelectItem>
              {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger><SelectValue placeholder="Zona" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las zonas</SelectItem>
              <SelectItem value="recepcion">Recepción</SelectItem>
              <SelectItem value="almacenamiento_general">Almacenamiento general</SelectItem>
              <SelectItem value="picking">Picking</SelectItem>
              <SelectItem value="despacho">Despacho</SelectItem>
              <SelectItem value="danados">Dañados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="inactive">Inactivas</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <WarehouseLocationList
            locations={filteredLocations}
            pendingIds={pendingLocationIds}
            failedIds={failedLocationIds}
            pendingDeleteIds={pendingDeleteLocationIds}
            onEdit={(location) => { setEditingLocation(location); setModalOpen(true); }}
            onDelete={handleDelete}
          />
          {hasMore && !search && warehouseFilter === 'all' && zoneFilter === 'all' && activeFilter === 'all' && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => loadLocations(true)} disabled={loadingMore}>
                {loadingMore ? 'Cargando...' : 'Cargar más'}
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Editar ubicación' : 'Nueva ubicación'}</DialogTitle>
          </DialogHeader>
          <WarehouseLocationForm
            initialData={editingLocation}
            warehouses={warehouses.filter((warehouse) => warehouse.is_active !== false)}
            onSubmit={handleSave}
            onCancel={() => { setModalOpen(false); setEditingLocation(null); }}
            submitting={saving}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={warehouseModalOpen} onOpenChange={setWarehouseModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingWarehouse ? 'Editar almacén' : 'Nuevo almacén'}</DialogTitle>
          </DialogHeader>
          <WarehouseForm
            initialData={editingWarehouse}
            onSubmit={handleSaveWarehouse}
            onCancel={() => { setWarehouseModalOpen(false); setEditingWarehouse(null); }}
            submitting={saving}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}