import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Layers, Plus } from 'lucide-react';
import { toast } from 'sonner';
import WarehouseLocationForm from '@/components/warehouse/WarehouseLocationForm';
import WarehouseLocationList from '@/components/warehouse/WarehouseLocationList';

const canAccessWarehouse = (user) => user?.role === 'admin' || ['warehouse', 'operations_manager'].includes(user?.custom_role);

export default function WarehouseLocations({ user }) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');

  const loadLocations = async () => {
    setLoading(true);
    const data = await base44.entities.WarehouseLocation.list('code', 200);
    setLocations(data || []);
    setLoading(false);
  };

  useEffect(() => { loadLocations(); }, []);

  const filteredLocations = useMemo(() => locations.filter((location) => {
    const matchesSearch = !search || [location.name, location.code, location.notes].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase()));
    const matchesZone = zoneFilter === 'all' || location.zone === zoneFilter;
    const matchesActive = activeFilter === 'all' || (activeFilter === 'active' ? location.is_active !== false : location.is_active === false);
    return matchesSearch && matchesZone && matchesActive;
  }), [locations, search, zoneFilter, activeFilter]);

  const handleSave = async (payload) => {
    try {
      setSaving(true);
      if (editingLocation) {
        await base44.functions.invoke('updateWarehouseLocation', { location_id: editingLocation.id, ...payload });
        toast.success('Ubicación actualizada');
      } else {
        await base44.functions.invoke('createWarehouseLocation', payload);
        toast.success('Ubicación creada');
      }
      setModalOpen(false);
      setEditingLocation(null);
      loadLocations();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'No se pudo guardar la ubicación');
    }
    setSaving(false);
  };

  const handleDelete = async (location) => {
    if (!window.confirm(`¿Eliminar ${location.name}?`)) return;
    try {
      await base44.functions.invoke('deleteWarehouseLocation', { location_id: location.id });
      toast.success('Ubicación eliminada');
      loadLocations();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'No se pudo eliminar la ubicación');
    }
  };

  if (!canAccessWarehouse(user)) {
    return <Card><CardContent className="p-8 text-center text-slate-500">No tienes acceso a este módulo.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Ubicaciones de almacén</h1>
          <p className="text-slate-500">Administra zonas, estanterías y espacios físicos.</p>
        </div>
        <Button onClick={() => { setEditingLocation(null); setModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" /> Nueva ubicación
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" /> Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Buscar por nombre o código" value={search} onChange={(e) => setSearch(e.target.value)} />
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
        <WarehouseLocationList
          locations={filteredLocations}
          onEdit={(location) => { setEditingLocation(location); setModalOpen(true); }}
          onDelete={handleDelete}
        />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Editar ubicación' : 'Nueva ubicación'}</DialogTitle>
          </DialogHeader>
          <WarehouseLocationForm
            initialData={editingLocation}
            onSubmit={handleSave}
            onCancel={() => { setModalOpen(false); setEditingLocation(null); }}
            submitting={saving}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}