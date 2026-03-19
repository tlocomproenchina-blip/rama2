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
import { Loader2, History, MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import EstadoLogisticaBadge from '@/components/logistica/EstadoLogisticaBadge';
import SeguimientoRutaForm from '@/components/logistica/SeguimientoRutaForm';

const emptyForm = {
  ruta_id: '',
  carga_ruta_id: '',
  fecha_hora: '',
  estado: 'salida',
  ubicacion: '',
  comentario: '',
  evidencia_url: '',
};

const formatDateTimeInput = (value) => value ? String(value).slice(0, 16) : '';

export default function AdminSeguimientoRutas({ user }) {
  const [seguimientos, setSeguimientos] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [cargas, setCargas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    const [seguimientoRows, rutasRows, cargasRows] = await Promise.all([
      base44.entities.SeguimientoRuta.list('-fecha_hora', 300),
      base44.entities.Ruta.list('-updated_date', 200),
      base44.entities.CargaRuta.list('-updated_date', 200),
    ]);
    setSeguimientos(seguimientoRows || []);
    setRutas(rutasRows || []);
    setCargas(cargasRows || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const rutasById = useMemo(() => Object.fromEntries(rutas.map((item) => [item.id, item])), [rutas]);
  const cargasById = useMemo(() => Object.fromEntries(cargas.map((item) => [item.id, item])), [cargas]);

  const filteredSeguimientos = useMemo(() => seguimientos.filter((item) => {
    const ruta = rutasById[item.ruta_id];
    const carga = cargasById[item.carga_ruta_id];
    const q = String(search || '').toLowerCase();
    return !q ||
      String(item.ubicacion || '').toLowerCase().includes(q) ||
      String(item.comentario || '').toLowerCase().includes(q) ||
      String(ruta?.codigo_ruta || '').toLowerCase().includes(q) ||
      String(carga?.tracking_number || carga?.descripcion || '').toLowerCase().includes(q);
  }), [cargasById, rutasById, search, seguimientos]);

  const stats = useMemo(() => ({
    total: seguimientos.length,
    transito: seguimientos.filter((item) => item.estado === 'en_transito').length,
    entregadas: seguimientos.filter((item) => item.estado === 'entregada').length,
    incidencias: seguimientos.filter((item) => item.estado === 'incidencia').length,
  }), [seguimientos]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, fecha_hora: formatDateTimeInput(new Date().toISOString()) });
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      ruta_id: item.ruta_id || '',
      carga_ruta_id: item.carga_ruta_id || '',
      fecha_hora: formatDateTimeInput(item.fecha_hora),
      estado: item.estado || 'salida',
      ubicacion: item.ubicacion || '',
      comentario: item.comentario || '',
      evidencia_url: item.evidencia_url || '',
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.ruta_id || !form.fecha_hora || !form.estado) {
      toast.error('Ruta, fecha y estado son obligatorios');
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      registrado_por: user?.email || '',
    };

    if (editing) {
      await base44.entities.SeguimientoRuta.update(editing.id, payload);
      toast.success('Seguimiento actualizado');
    } else {
      await base44.entities.SeguimientoRuta.create(payload);
      toast.success('Seguimiento registrado');
    }

    setSaving(false);
    setOpen(false);
    setForm(emptyForm);
    await loadData();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await base44.entities.SeguimientoRuta.delete(deleting.id);
    toast.success('Seguimiento eliminado');
    setDeleting(null);
    await loadData();
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-orange-100">
              <History className="h-3.5 w-3.5" />
              Seguimiento de entregas
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Seguimiento de Rutas</h1>
            <p className="max-w-2xl text-sm text-slate-200 md:text-base">
              Registra novedades, incidencias y entregas por ruta o por carga específica.
            </p>
          </div>
          <Button onClick={openCreate} className="bg-white text-slate-900 hover:bg-slate-100">
            <Plus className="h-4 w-4" /> Nuevo seguimiento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Total</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">En tránsito</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.transito}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Entregadas</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.entregadas}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Incidencias</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.incidencias}</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Bitácora de seguimiento</CardTitle>
          <CardDescription>Visualiza y registra eventos operativos de cada ruta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por ruta, carga, ubicación o comentario" className="pl-10" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredSeguimientos.map((item) => {
              const ruta = rutasById[item.ruta_id];
              const carga = cargasById[item.carga_ruta_id];
              return (
                <Card key={item.id} className="border border-slate-100 bg-slate-50/70 shadow-sm">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{ruta?.codigo_ruta || 'Ruta sin código'}</h3>
                        <p className="text-sm text-slate-500">{formatDateTimeInput(item.fecha_hora).replace('T', ' ') || '—'}</p>
                      </div>
                      <EstadoLogisticaBadge value={item.estado} />
                    </div>

                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /> {item.ubicacion || 'Sin ubicación'}</div>
                      <div><span className="font-medium text-slate-800">Carga:</span> {carga?.tracking_number || carga?.descripcion || 'General de la ruta'}</div>
                      <div><span className="font-medium text-slate-800">Comentario:</span> {item.comentario || 'Sin comentario'}</div>
                      <div><span className="font-medium text-slate-800">Registrado por:</span> {item.registrado_por || '—'}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" /> Editar
                      </Button>
                      <Button variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setDeleting(item)}>
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
            <DialogTitle>{editing ? 'Editar seguimiento' : 'Nuevo seguimiento'}</DialogTitle>
          </DialogHeader>
          <SeguimientoRutaForm value={form} onChange={setForm} rutas={rutas} cargas={cargas} />
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
            <AlertDialogTitle>Eliminar seguimiento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el registro de seguimiento seleccionado.
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