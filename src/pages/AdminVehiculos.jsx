import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Search, Truck, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import VehiculoForm from '@/components/logistica/VehiculoForm';
import EstadoLogisticaBadge from '@/components/logistica/EstadoLogisticaBadge';

const emptyForm = {
  placa: '',
  tipo: 'camion',
  marca: '',
  modelo: '',
  anio: '',
  capacidad_peso_kg: '',
  capacidad_volumen_m3: '',
  estado: 'disponible',
  chofer_id: '',
  chofer_nombre: '',
  observaciones: '',
};

export default function AdminVehiculos() {
  const [vehiculos, setVehiculos] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    const [vehiculosRows, choferesRows] = await Promise.all([
      base44.entities.Vehiculo.list('-updated_date', 200),
      base44.entities.Chofer.list('-updated_date', 200),
    ]);
    setVehiculos(vehiculosRows || []);
    setChoferes(choferesRows || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredVehiculos = useMemo(() => vehiculos.filter((item) => {
    const q = String(search || '').toLowerCase();
    return !q ||
      String(item.placa || '').toLowerCase().includes(q) ||
      String(item.marca || '').toLowerCase().includes(q) ||
      String(item.modelo || '').toLowerCase().includes(q) ||
      String(item.chofer_nombre || '').toLowerCase().includes(q);
  }), [vehiculos, search]);

  const stats = useMemo(() => ({
    total: vehiculos.length,
    disponibles: vehiculos.filter((item) => item.estado === 'disponible').length,
    enRuta: vehiculos.filter((item) => item.estado === 'en_ruta').length,
    mantenimiento: vehiculos.filter((item) => item.estado === 'mantenimiento').length,
  }), [vehiculos]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (vehiculo) => {
    setEditing(vehiculo);
    setForm({
      placa: vehiculo.placa || '',
      tipo: vehiculo.tipo || 'camion',
      marca: vehiculo.marca || '',
      modelo: vehiculo.modelo || '',
      anio: vehiculo.anio || '',
      capacidad_peso_kg: vehiculo.capacidad_peso_kg || '',
      capacidad_volumen_m3: vehiculo.capacidad_volumen_m3 || '',
      estado: vehiculo.estado || 'disponible',
      chofer_id: vehiculo.chofer_id || '',
      chofer_nombre: vehiculo.chofer_nombre || '',
      observaciones: vehiculo.observaciones || '',
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.placa.trim()) {
      toast.error('La placa es obligatoria');
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      anio: form.anio ? Number(form.anio) : null,
      capacidad_peso_kg: form.capacidad_peso_kg ? Number(form.capacidad_peso_kg) : 0,
      capacidad_volumen_m3: form.capacidad_volumen_m3 ? Number(form.capacidad_volumen_m3) : 0,
    };
    if (editing) {
      await base44.entities.Vehiculo.update(editing.id, payload);
      toast.success('Vehículo actualizado');
    } else {
      await base44.entities.Vehiculo.create(payload);
      toast.success('Vehículo creado');
    }
    setSaving(false);
    setOpen(false);
    setForm(emptyForm);
    await loadData();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await base44.entities.Vehiculo.delete(deleting.id);
    toast.success('Vehículo eliminado');
    setDeleting(null);
    await loadData();
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100">
              <Truck className="h-3.5 w-3.5" />
              Gestión de flota
            </div>
            {loading && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Actualizando datos
              </div>
            )}
            <h1 className="text-3xl font-bold tracking-tight">Vehículos</h1>
            <p className="max-w-2xl text-sm text-slate-200 md:text-base">
              Registra y administra la flota disponible para las rutas del módulo logístico.
            </p>
          </div>
          <Button onClick={openCreate} className="bg-white text-slate-900 hover:bg-slate-100">
            <Plus className="h-4 w-4" /> Nuevo vehículo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Total</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Disponibles</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.disponibles}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">En ruta</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.enRuta}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Mantenimiento</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.mantenimiento}</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Directorio de vehículos</CardTitle>
          <CardDescription>Consulta, registra o edita la flota disponible.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por placa, marca, modelo o chofer" className="pl-10" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredVehiculos.map((vehiculo) => (
              <Card key={vehiculo.id} className="border border-slate-100 bg-slate-50/70 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{vehiculo.placa}</h3>
                      <p className="text-sm text-slate-500">{vehiculo.marca || 'Sin marca'} · {vehiculo.modelo || 'Sin modelo'}</p>
                    </div>
                    <EstadoLogisticaBadge value={vehiculo.estado} />
                  </div>

                  <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <div><span className="font-medium text-slate-800">Tipo:</span> {vehiculo.tipo}</div>
                    <div><span className="font-medium text-slate-800">Año:</span> {vehiculo.anio || '—'}</div>
                    <div><span className="font-medium text-slate-800">Peso:</span> {vehiculo.capacidad_peso_kg || 0} kg</div>
                    <div><span className="font-medium text-slate-800">Volumen:</span> {vehiculo.capacidad_volumen_m3 || 0} m³</div>
                    <div className="md:col-span-2"><span className="font-medium text-slate-800">Chofer:</span> {vehiculo.chofer_nombre || 'Sin asignar'}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => openEdit(vehiculo)}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setDeleting(vehiculo)}>
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar vehículo' : 'Nuevo vehículo'}</DialogTitle>
          </DialogHeader>
          <VehiculoForm value={form} onChange={setForm} choferes={choferes} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar vehículo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el vehículo {deleting?.placa} del módulo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}