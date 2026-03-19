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
import { Loader2, Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import EstadoLogisticaBadge from '@/components/logistica/EstadoLogisticaBadge';
import CargaRutaForm from '@/components/logistica/CargaRutaForm';

const emptyForm = {
  ruta_id: '',
  tipo_carga: 'paquete',
  package_id: '',
  tracking_number: '',
  descripcion: '',
  cliente_email: '',
  peso_kg: '',
  volumen_m3: '',
  cantidad_bultos: '1',
  estado_entrega: 'pendiente',
  destino_entrega: '',
  observaciones: '',
};

export default function AdminCargaRutas() {
  const urlParams = new URLSearchParams(window.location.search);
  const rutaFilterId = urlParams.get('ruta_id') || '';
  const [cargas, setCargas] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    const [cargasRows, rutasRows, packageRows] = await Promise.all([
      base44.entities.CargaRuta.list('-updated_date', 200),
      base44.entities.Ruta.list('-updated_date', 200),
      base44.entities.Package.list('-updated_date', 200),
    ]);
    setCargas(cargasRows || []);
    setRutas(rutasRows || []);
    setPackages(packageRows || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const rutasById = useMemo(() => Object.fromEntries(rutas.map((item) => [item.id, item])), [rutas]);

  const filteredCargas = useMemo(() => cargas.filter((item) => {
    const q = String(search || '').toLowerCase();
    const ruta = rutasById[item.ruta_id];
    const routeMatch = !rutaFilterId || item.ruta_id === rutaFilterId;
    const textMatch = !q ||
      String(item.tracking_number || '').toLowerCase().includes(q) ||
      String(item.descripcion || '').toLowerCase().includes(q) ||
      String(item.cliente_email || '').toLowerCase().includes(q) ||
      String(ruta?.codigo_ruta || '').toLowerCase().includes(q);
    return routeMatch && textMatch;
  }), [cargas, rutaFilterId, rutasById, search]);

  const stats = useMemo(() => ({
    total: cargas.length,
    pendientes: cargas.filter((item) => item.estado_entrega === 'pendiente').length,
    transito: cargas.filter((item) => item.estado_entrega === 'en_transito').length,
    entregadas: cargas.filter((item) => item.estado_entrega === 'entregada').length,
  }), [cargas]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, ruta_id: rutaFilterId });
    setOpen(true);
  };

  const openEdit = (carga) => {
    setEditing(carga);
    setForm({
      ruta_id: carga.ruta_id || '',
      tipo_carga: carga.tipo_carga || 'paquete',
      package_id: carga.package_id || '',
      tracking_number: carga.tracking_number || '',
      descripcion: carga.descripcion || '',
      cliente_email: carga.cliente_email || '',
      peso_kg: carga.peso_kg || '',
      volumen_m3: carga.volumen_m3 || '',
      cantidad_bultos: carga.cantidad_bultos || '1',
      estado_entrega: carga.estado_entrega || 'pendiente',
      destino_entrega: carga.destino_entrega || '',
      observaciones: carga.observaciones || '',
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.ruta_id || !form.descripcion.trim()) {
      toast.error('La ruta y la descripción son obligatorias');
      return;
    }

    if (form.tipo_carga === 'paquete' && form.package_id) {
      const duplicate = cargas.find((item) => item.package_id === form.package_id && item.id !== editing?.id);
      if (duplicate) {
        toast.error('Ese paquete ya fue asignado a una ruta');
        return;
      }
    }

    setSaving(true);
    const payload = {
      ...form,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : 0,
      volumen_m3: form.volumen_m3 ? Number(form.volumen_m3) : 0,
      cantidad_bultos: form.cantidad_bultos ? Number(form.cantidad_bultos) : 1,
    };

    if (editing) {
      await base44.entities.CargaRuta.update(editing.id, payload);
      toast.success('Carga actualizada');
    } else {
      await base44.entities.CargaRuta.create(payload);
      toast.success('Carga asignada');
    }

    setSaving(false);
    setOpen(false);
    setForm(emptyForm);
    await loadData();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await base44.entities.CargaRuta.delete(deleting.id);
    toast.success('Carga eliminada');
    setDeleting(null);
    await loadData();
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-cyan-100">
              <Package className="h-3.5 w-3.5" />
              Asignación de carga
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Cargas de Ruta</h1>
            <p className="max-w-2xl text-sm text-slate-200 md:text-base">
              Asigna paquetes o cargas completas a cada ruta y controla su estado de entrega.
            </p>
          </div>
          <Button onClick={openCreate} className="bg-white text-slate-900 hover:bg-slate-100">
            <Plus className="h-4 w-4" /> Nueva carga
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Total</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Pendientes</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.pendientes}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">En tránsito</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.transito}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Entregadas</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.entregadas}</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Directorio de cargas</CardTitle>
          <CardDescription>Consulta y administra la carga asignada a cada ruta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rutaFilterId && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-900">
              <span>Mostrando cargas de la ruta: <strong>{rutasById[rutaFilterId]?.codigo_ruta || 'seleccionada'}</strong></span>
              <Button variant="outline" onClick={() => window.location.href = '/AdminCargaRutas'}>Quitar filtro</Button>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por tracking, descripción, cliente o ruta" className="pl-10" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredCargas.map((carga) => {
              const ruta = rutasById[carga.ruta_id];
              return (
                <Card key={carga.id} className="border border-slate-100 bg-slate-50/70 shadow-sm">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{carga.tracking_number || carga.descripcion}</h3>
                        <p className="text-sm text-slate-500">{ruta?.codigo_ruta || 'Sin ruta'} · {carga.tipo_carga}</p>
                      </div>
                      <EstadoLogisticaBadge value={carga.estado_entrega} />
                    </div>

                    <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                      <div><span className="font-medium text-slate-800">Cliente:</span> {carga.cliente_email || '—'}</div>
                      <div><span className="font-medium text-slate-800">Bultos:</span> {carga.cantidad_bultos || 1}</div>
                      <div><span className="font-medium text-slate-800">Peso:</span> {carga.peso_kg || 0} kg</div>
                      <div><span className="font-medium text-slate-800">Volumen:</span> {carga.volumen_m3 || 0} m³</div>
                      <div className="md:col-span-2"><span className="font-medium text-slate-800">Destino:</span> {carga.destino_entrega || '—'}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => openEdit(carga)}>
                        <Pencil className="h-4 w-4" /> Editar
                      </Button>
                      <Button variant="outline" onClick={() => window.location.href = `/AdminSeguimientoRutas?ruta_id=${carga.ruta_id}&carga_id=${carga.id}`}>
                        Seguimiento
                      </Button>
                      <Button variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setDeleting(carga)}>
                        <Trash2 className="h-4 w-4" /> Eliminar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar carga' : 'Nueva carga de ruta'}</DialogTitle>
          </DialogHeader>
          <CargaRutaForm value={form} onChange={setForm} rutas={rutas} packages={packages} />
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
            <AlertDialogTitle>Eliminar carga</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la carga seleccionada del módulo.
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