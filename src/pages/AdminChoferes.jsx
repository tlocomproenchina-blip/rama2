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
import { Loader2, Plus, Search, UserCheck, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ChoferForm from '@/components/logistica/ChoferForm';
import EstadoLogisticaBadge from '@/components/logistica/EstadoLogisticaBadge';

const emptyForm = {
  nombres: '',
  apellidos: '',
  cedula: '',
  telefono: '',
  licencia: '',
  categoria_licencia: '',
  fecha_vencimiento_licencia: '',
  estado: 'disponible',
  direccion: '',
  observaciones: '',
};

export default function AdminChoferes() {
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
    const rows = await base44.entities.Chofer.list('-updated_date', 200);
    setChoferes(rows || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredChoferes = useMemo(() => choferes.filter((item) => {
    const q = String(search || '').toLowerCase();
    const fullName = `${item.nombres || ''} ${item.apellidos || ''}`.trim().toLowerCase();
    return !q ||
      fullName.includes(q) ||
      String(item.cedula || '').toLowerCase().includes(q) ||
      String(item.telefono || '').toLowerCase().includes(q) ||
      String(item.licencia || '').toLowerCase().includes(q);
  }), [choferes, search]);

  const stats = useMemo(() => ({
    total: choferes.length,
    disponibles: choferes.filter((item) => item.estado === 'disponible').length,
    enRuta: choferes.filter((item) => item.estado === 'en_ruta').length,
    inactivos: choferes.filter((item) => item.estado === 'inactivo').length,
  }), [choferes]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (chofer) => {
    setEditing(chofer);
    setForm({
      nombres: chofer.nombres || '',
      apellidos: chofer.apellidos || '',
      cedula: chofer.cedula || '',
      telefono: chofer.telefono || '',
      licencia: chofer.licencia || '',
      categoria_licencia: chofer.categoria_licencia || '',
      fecha_vencimiento_licencia: chofer.fecha_vencimiento_licencia || '',
      estado: chofer.estado || 'disponible',
      direccion: chofer.direccion || '',
      observaciones: chofer.observaciones || '',
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombres.trim() || !form.apellidos.trim()) {
      toast.error('El nombre del chofer es obligatorio');
      return;
    }
    setSaving(true);
    if (editing) {
      await base44.entities.Chofer.update(editing.id, form);
      toast.success('Chofer actualizado');
    } else {
      await base44.entities.Chofer.create(form);
      toast.success('Chofer creado');
    }
    setSaving(false);
    setOpen(false);
    setForm(emptyForm);
    await loadData();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await base44.entities.Chofer.delete(deleting.id);
    toast.success('Chofer eliminado');
    setDeleting(null);
    await loadData();
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-emerald-100">
              <UserCheck className="h-3.5 w-3.5" />
              Gestión de choferes
            </div>
            {loading && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Actualizando datos
              </div>
            )}
            <h1 className="text-3xl font-bold tracking-tight">Choferes</h1>
            <p className="max-w-2xl text-sm text-slate-200 md:text-base">
              Registra y administra los choferes disponibles para la operación de rutas.
            </p>
          </div>
          <Button onClick={openCreate} className="bg-white text-slate-900 hover:bg-slate-100">
            <Plus className="h-4 w-4" /> Nuevo chofer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Total</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Disponibles</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.disponibles}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">En ruta</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.enRuta}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Inactivos</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.inactivos}</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Directorio de choferes</CardTitle>
          <CardDescription>Consulta, registra o edita la disponibilidad del personal de conducción.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, cédula, teléfono o licencia" className="pl-10" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredChoferes.map((chofer) => (
              <Card key={chofer.id} className="border border-slate-100 bg-slate-50/70 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{`${chofer.nombres || ''} ${chofer.apellidos || ''}`.trim()}</h3>
                      <p className="text-sm text-slate-500">Cédula: {chofer.cedula || '—'}</p>
                    </div>
                    <EstadoLogisticaBadge value={chofer.estado} />
                  </div>

                  <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <div><span className="font-medium text-slate-800">Teléfono:</span> {chofer.telefono || '—'}</div>
                    <div><span className="font-medium text-slate-800">Licencia:</span> {chofer.licencia || '—'}</div>
                    <div><span className="font-medium text-slate-800">Categoría:</span> {chofer.categoria_licencia || '—'}</div>
                    <div><span className="font-medium text-slate-800">Vence:</span> {chofer.fecha_vencimiento_licencia || '—'}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => openEdit(chofer)}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setDeleting(chofer)}>
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
            <DialogTitle>{editing ? 'Editar chofer' : 'Nuevo chofer'}</DialogTitle>
          </DialogHeader>
          <ChoferForm value={form} onChange={setForm} />
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
            <AlertDialogTitle>Eliminar chofer</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el chofer seleccionado del módulo.
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