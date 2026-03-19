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
import { Loader2, Plus, Search, Route, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import RutaForm from '@/components/logistica/RutaForm';
import EstadoLogisticaBadge from '@/components/logistica/EstadoLogisticaBadge';

const emptyForm = {
  codigo_ruta: '',
  tipo_ruta: 'urbana',
  origen: '',
  destino: '',
  fecha_salida: '',
  fecha_estimada_entrega: '',
  vehiculo_id: '',
  vehiculo_placa: '',
  chofer_id: '',
  chofer_nombre: '',
  estado: 'planificada',
  total_paradas: '',
  observaciones: '',
};

const activeStates = ['asignada', 'en_curso'];
const formatDateTimeInput = (value) => value ? String(value).slice(0, 16) : '';
const formatDateTimeDisplay = (value) => value ? String(value).slice(0, 16).replace('T', ' ') : '—';

export default function AdminRutas() {
  const [rutas, setRutas] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [cargas, setCargas] = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    const [rutasRows, vehiculosRows, choferesRows, cargasRows, seguimientosRows] = await Promise.all([
      base44.entities.Ruta.list('-updated_date', 200),
      base44.entities.Vehiculo.list('-updated_date', 200),
      base44.entities.Chofer.list('-updated_date', 200),
      base44.entities.CargaRuta.list('-updated_date', 300),
      base44.entities.SeguimientoRuta.list('-fecha_hora', 300),
    ]);
    setRutas(rutasRows || []);
    setVehiculos(vehiculosRows || []);
    setChoferes(choferesRows || []);
    setCargas(cargasRows || []);
    setSeguimientos(seguimientosRows || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRutas = useMemo(() => rutas.filter((item) => {
    const q = String(search || '').toLowerCase();
    return !q ||
      String(item.codigo_ruta || '').toLowerCase().includes(q) ||
      String(item.origen || '').toLowerCase().includes(q) ||
      String(item.destino || '').toLowerCase().includes(q) ||
      String(item.vehiculo_placa || '').toLowerCase().includes(q) ||
      String(item.chofer_nombre || '').toLowerCase().includes(q);
  }), [rutas, search]);

  const stats = useMemo(() => ({
    total: rutas.length,
    planificadas: rutas.filter((item) => item.estado === 'planificada').length,
    enCurso: rutas.filter((item) => item.estado === 'en_curso').length,
    completadas: rutas.filter((item) => item.estado === 'completada').length,
  }), [rutas]);

  const cargasPorRuta = useMemo(() => cargas.reduce((acc, item) => {
    acc[item.ruta_id] = (acc[item.ruta_id] || 0) + 1;
    return acc;
  }, {}), [cargas]);

  const cargaResumenPorRuta = useMemo(() => cargas.reduce((acc, item) => {
    const current = acc[item.ruta_id] || { peso: 0, volumen: 0 };
    acc[item.ruta_id] = {
      peso: current.peso + Number(item.peso_kg || 0),
      volumen: current.volumen + Number(item.volumen_m3 || 0),
    };
    return acc;
  }, {}), [cargas]);

  const entregasPendientesPorRuta = useMemo(() => cargas.reduce((acc, item) => {
    if (['pendiente', 'en_transito', 'entrega_parcial'].includes(item.estado_entrega)) {
      acc[item.ruta_id] = (acc[item.ruta_id] || 0) + 1;
    }
    return acc;
  }, {}), [cargas]);

  const entregasCompletadasPorRuta = useMemo(() => cargas.reduce((acc, item) => {
    if (item.estado_entrega === 'entregada') {
      acc[item.ruta_id] = (acc[item.ruta_id] || 0) + 1;
    }
    return acc;
  }, {}), [cargas]);

  const vehiculosById = useMemo(() => Object.fromEntries(vehiculos.map((item) => [item.id, item])), [vehiculos]);

  const ultimoSeguimientoPorRuta = useMemo(() => seguimientos.reduce((acc, item) => {
    if (!item.ruta_id) return acc;
    if (!acc[item.ruta_id]) acc[item.ruta_id] = item;
    return acc;
  }, {}), [seguimientos]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (ruta) => {
    setEditing(ruta);
    setForm({
      codigo_ruta: ruta.codigo_ruta || '',
      tipo_ruta: ruta.tipo_ruta || 'urbana',
      origen: ruta.origen || '',
      destino: ruta.destino || '',
      fecha_salida: formatDateTimeInput(ruta.fecha_salida),
      fecha_estimada_entrega: formatDateTimeInput(ruta.fecha_estimada_entrega),
      vehiculo_id: ruta.vehiculo_id || '',
      vehiculo_placa: ruta.vehiculo_placa || '',
      chofer_id: ruta.chofer_id || '',
      chofer_nombre: ruta.chofer_nombre || '',
      estado: ruta.estado || 'planificada',
      total_paradas: ruta.total_paradas || '',
      observaciones: ruta.observaciones || '',
    });
    setOpen(true);
  };

  const hasResourceConflict = (payload) => rutas.some((ruta) => {
    if (editing && ruta.id === editing.id) return false;
    if (!activeStates.includes(ruta.estado)) return false;
    return (payload.vehiculo_id && ruta.vehiculo_id === payload.vehiculo_id) || (payload.chofer_id && ruta.chofer_id === payload.chofer_id);
  });

  const hasOtherActiveRoute = (field, value, excludeId) => rutas.some((ruta) => {
    if (!value) return false;
    if (ruta.id === excludeId) return false;
    if (!activeStates.includes(ruta.estado)) return false;
    return ruta[field] === value;
  });

  const handleSave = async () => {
    if (!form.codigo_ruta.trim() || !form.origen.trim() || !form.destino.trim()) {
      toast.error('Código, origen y destino son obligatorios');
      return;
    }

    const payload = {
      ...form,
      total_paradas: form.total_paradas ? Number(form.total_paradas) : 0,
    };

    if (activeStates.includes(payload.estado) && hasResourceConflict(payload)) {
      toast.error('El vehículo o el chofer ya tienen otra ruta activa');
      return;
    }

    const validationResponse = await base44.functions.invoke('validateRouteAssignment', {
      routeId: editing?.id || '',
      vehicleId: payload.vehiculo_id,
      driverId: payload.chofer_id,
      routeStatus: payload.estado,
    });
    const validation = validationResponse.data;

    if (!validation?.valid) {
      if (validation?.vehicleConflict) {
        toast.error(`El vehículo ya está asignado a la ruta ${validation.vehicleConflict.codigo_ruta}`);
      } else if (validation?.driverConflict) {
        toast.error(`El chofer ya está asignado a la ruta ${validation.driverConflict.codigo_ruta}`);
      } else {
        toast.error('No se pudo validar la asignación de la ruta');
      }
      return;
    }

    setSaving(true);
    if (editing) {
      await base44.entities.Ruta.update(editing.id, payload);
    } else {
      await base44.entities.Ruta.create(payload);
    }

    const nextResourceState = activeStates.includes(payload.estado) ? 'en_ruta' : 'disponible';

    if (editing?.vehiculo_id && editing.vehiculo_id !== payload.vehiculo_id && !hasOtherActiveRoute('vehiculo_id', editing.vehiculo_id, editing.id)) {
      await base44.entities.Vehiculo.update(editing.vehiculo_id, { estado: 'disponible', chofer_id: '', chofer_nombre: '' });
    }

    if (editing?.chofer_id && editing.chofer_id !== payload.chofer_id && !hasOtherActiveRoute('chofer_id', editing.chofer_id, editing.id)) {
      await base44.entities.Chofer.update(editing.chofer_id, { estado: 'disponible' });
    }

    if (payload.vehiculo_id) {
      await base44.entities.Vehiculo.update(payload.vehiculo_id, {
        estado: nextResourceState,
        chofer_id: payload.chofer_id || '',
        chofer_nombre: payload.chofer_nombre || '',
      });
    }

    if (payload.chofer_id) {
      await base44.entities.Chofer.update(payload.chofer_id, { estado: nextResourceState });
    }

    toast.success(editing ? 'Ruta actualizada' : 'Ruta creada');
    setSaving(false);
    setOpen(false);
    setForm(emptyForm);
    await loadData();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await base44.entities.Ruta.delete(deleting.id);

    if (deleting.vehiculo_id && !hasOtherActiveRoute('vehiculo_id', deleting.vehiculo_id, deleting.id)) {
      await base44.entities.Vehiculo.update(deleting.vehiculo_id, { estado: 'disponible', chofer_id: '', chofer_nombre: '' });
    }

    if (deleting.chofer_id && !hasOtherActiveRoute('chofer_id', deleting.chofer_id, deleting.id)) {
      await base44.entities.Chofer.update(deleting.chofer_id, { estado: 'disponible' });
    }

    toast.success('Ruta eliminada');
    setDeleting(null);
    await loadData();
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-violet-100">
              <Route className="h-3.5 w-3.5" />
              Gestión de rutas
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Rutas</h1>
            <p className="max-w-2xl text-sm text-slate-200 md:text-base">
              Crea rutas, asigna vehículo y chofer, y controla el estado operativo de cada recorrido.
            </p>
          </div>
          <Button onClick={openCreate} className="bg-white text-slate-900 hover:bg-slate-100">
            <Plus className="h-4 w-4" /> Nueva ruta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Total</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Planificadas</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.planificadas}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">En curso</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.enCurso}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Completadas</p><p className="mt-2 text-3xl font-bold text-slate-900">{stats.completadas}</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Directorio de rutas</CardTitle>
          <CardDescription>Administra la planificación y asignación operativa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, origen, destino, vehículo o chofer" className="pl-10" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredRutas.map((ruta) => {
              const cargaResumen = cargaResumenPorRuta[ruta.id] || { peso: 0, volumen: 0 };
              const vehiculo = vehiculosById[ruta.vehiculo_id];
              const exceedsPeso = vehiculo?.capacidad_peso_kg && cargaResumen.peso > vehiculo.capacidad_peso_kg;
              const exceedsVolumen = vehiculo?.capacidad_volumen_m3 && cargaResumen.volumen > vehiculo.capacidad_volumen_m3;

              return (
              <Card key={ruta.id} className="border border-slate-100 bg-slate-50/70 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{ruta.codigo_ruta}</h3>
                      <p className="text-sm text-slate-500">{ruta.origen} → {ruta.destino}</p>
                    </div>
                    <EstadoLogisticaBadge value={ruta.estado} />
                  </div>

                  <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <div><span className="font-medium text-slate-800">Tipo:</span> {ruta.tipo_ruta}</div>
                    <div><span className="font-medium text-slate-800">Paradas:</span> {ruta.total_paradas || 0}</div>
                    <div><span className="font-medium text-slate-800">Vehículo:</span> {ruta.vehiculo_placa || 'Sin asignar'}</div>
                    <div><span className="font-medium text-slate-800">Chofer:</span> {ruta.chofer_nombre || 'Sin asignar'}</div>
                    <div><span className="font-medium text-slate-800">Salida:</span> {formatDateTimeInput(ruta.fecha_salida) || '—'}</div>
                    <div><span className="font-medium text-slate-800">Entrega:</span> {formatDateTimeInput(ruta.fecha_estimada_entrega) || '—'}</div>
                    <div className="md:col-span-2"><span className="font-medium text-slate-800">Cargas asignadas:</span> {cargasPorRuta[ruta.id] || 0}</div>
                    <div><span className="font-medium text-slate-800">Entregas pendientes:</span> {entregasPendientesPorRuta[ruta.id] || 0}</div>
                    <div><span className="font-medium text-slate-800">Entregas completadas:</span> {entregasCompletadasPorRuta[ruta.id] || 0}</div>
                    <div><span className="font-medium text-slate-800">Peso cargado:</span> {cargaResumen.peso} kg</div>
                    <div><span className="font-medium text-slate-800">Volumen cargado:</span> {cargaResumen.volumen} m³</div>
                    <div className="md:col-span-2"><span className="font-medium text-slate-800">Capacidad:</span> {vehiculo ? `${vehiculo.capacidad_peso_kg || 0} kg · ${vehiculo.capacidad_volumen_m3 || 0} m³` : 'Sin vehículo asignado'}</div>
                    {(exceedsPeso || exceedsVolumen) && (
                      <div className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        Atención: la carga supera la capacidad {exceedsPeso && exceedsVolumen ? 'de peso y volumen' : exceedsPeso ? 'de peso' : 'de volumen'} del vehículo.
                      </div>
                    )}
                    <div className="md:col-span-2"><span className="font-medium text-slate-800">Último seguimiento:</span> {ultimoSeguimientoPorRuta[ruta.id]?.estado ? String(ultimoSeguimientoPorRuta[ruta.id].estado).replaceAll('_', ' ') : 'Sin registros'}</div>
                    <div className="md:col-span-2"><span className="font-medium text-slate-800">Última ubicación:</span> {ultimoSeguimientoPorRuta[ruta.id]?.ubicacion || '—'}</div>
                    <div className="md:col-span-2"><span className="font-medium text-slate-800">Último evento:</span> {formatDateTimeDisplay(ultimoSeguimientoPorRuta[ruta.id]?.fecha_hora)}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => window.location.href = `/AdminRutaDetalle?ruta_id=${ruta.id}`}>
                      Ver detalle
                    </Button>
                    <Button variant="outline" onClick={() => openEdit(ruta)}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button variant="outline" onClick={() => window.location.href = `/AdminCargaRutas?ruta_id=${ruta.id}`}>
                      Ver cargas
                    </Button>
                    <Button variant="outline" onClick={() => window.location.href = `/AdminCargaRutas?ruta_id=${ruta.id}&action=new`}>
                      Nueva carga
                    </Button>
                    <Button variant="outline" onClick={() => window.location.href = `/AdminSeguimientoRutas?ruta_id=${ruta.id}&action=new`}>
                      Nuevo seguimiento
                    </Button>
                    <Button variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setDeleting(ruta)}>
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );})}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar ruta' : 'Nueva ruta'}</DialogTitle>
          </DialogHeader>
          <RutaForm value={form} onChange={setForm} vehiculos={vehiculos} choferes={choferes} />
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
            <AlertDialogTitle>Eliminar ruta</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la ruta {deleting?.codigo_ruta} del módulo.
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