import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, Package, Trash2, CalendarDays, TrendingUp, Users, Search, Filter, MapPin, Pencil, CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import CbmDatePicker from '@/components/admin/CbmDatePicker';
import { toast } from 'sonner';
import PageHero from '@/components/common/PageHero';
import CbmMonthlySummary from '@/components/accounting/CbmMonthlySummary';
import CbmClientSummary from '@/components/accounting/CbmClientSummary';
import CbmStateCostPanel from '@/components/accounting/CbmStateCostPanel';


export default function AdminCbmIngresos({ user }) {
  const [ingresos, setIngresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-01'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [form, setForm] = useState({ cbm: '', fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm"), descripcion: '', proveedor: '', notas: '', client_email: '', client_name: '', shipping_mark: '', tracking_numbers: [], invoice_number: '' });
  const [editingId, setEditingId] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientPackages, setClientPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const all = await base44.entities.CbmIngreso.list('-fecha', 500);
    const fromDate = new Date(dateFrom + 'T00:00:00');
    const toDate = new Date(dateTo + 'T23:59:59');
    const filtered = (all || []).filter(item => {
      if (!item.fecha) return false;
      const d = new Date(item.fecha);
      return d >= fromDate && d <= toDate;
    });
    setIngresos(filtered);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [dateFrom, dateTo]);

  // Load clients for search
  const searchClients = async (query) => {
    if (!query || query.length < 2) { setClients([]); return; }
    setLoadingClients(true);
    // Traer todos los usuarios para búsqueda completa
    let allUsers = [];
    let skip = 0;
    const batchSize = 200;
    while (true) {
      const batch = await base44.entities.User.list('-created_date', batchSize, skip);
      if (!batch || batch.length === 0) break;
      allUsers = allUsers.concat(batch);
      if (batch.length < batchSize) break;
      skip += batchSize;
    }
    const q = query.toLowerCase();
    const filtered = allUsers.filter(u =>
      u.role === 'user' && (
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.shipping_mark || '').toLowerCase().includes(q) ||
        (u.first_name || '').toLowerCase().includes(q) ||
        (u.last_name || '').toLowerCase().includes(q)
      )
    );
    setClients(filtered);
    setLoadingClients(false);
  };

  const totalCbm = useMemo(() =>
    ingresos.reduce((sum, i) => sum + Number(i.cbm || 0), 0),
    [ingresos]
  );

  const clientTotals = useMemo(() => {
    const map = {};
    ingresos.forEach(i => {
      const key = i.client_email || '__sin_cliente__';
      if (!map[key]) map[key] = { email: i.client_email, name: i.client_name || i.client_email || 'Sin cliente', mark: i.shipping_mark || '', cbm: 0, count: 0 };
      map[key].cbm += Number(i.cbm || 0);
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.cbm - a.cbm);
  }, [ingresos]);

  const handleSelectClient = async (client) => {
    setForm({
      ...form,
      client_email: client.email,
      client_name: `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.full_name || client.email,
      shipping_mark: client.shipping_mark || ''
    });
    setClientSearch('');
    setClients([]);
    // Load received packages for this client, excluding those already in a CbmIngreso
    setLoadingPackages(true);
    try {
      const [pkgs, allCbm] = await Promise.all([
        base44.entities.Package.filter({ client_email: client.email, status: 'recibido' }, '-received_date', 200),
        base44.entities.CbmIngreso.filter({ client_email: client.email }, '-fecha', 500)
      ]);
      // Collect all tracking numbers already used in other CbmIngreso records (except the one being edited)
      const usedTrackings = new Set();
      (allCbm || []).forEach(cbm => {
        if (editingId && cbm.id === editingId) return; // allow current record's trackings
        (cbm.tracking_numbers || []).forEach(t => usedTrackings.add(t));
      });
      const available = (pkgs || []).filter(p => !usedTrackings.has(p.tracking_number));
      setClientPackages(available);
    } catch { setClientPackages([]); }
    setLoadingPackages(false);
  };

  const handleClearClient = () => {
    setForm({ ...form, client_email: '', client_name: '', shipping_mark: '' });
    setClientPackages([]);
  };

  const handleEdit = async (item) => {
    try {
      // Verify record still exists before editing
      const fresh = await base44.entities.CbmIngreso.get(item.id);
      setEditingId(fresh.id);
      setForm({
        cbm: String(fresh.cbm || ''),
        fecha: fresh.fecha ? format(new Date(fresh.fecha), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        descripcion: fresh.descripcion || '',
        proveedor: fresh.proveedor || '',
        notas: fresh.notas || '',
        client_email: fresh.client_email || '',
        client_name: fresh.client_name || '',
        shipping_mark: fresh.shipping_mark || '',
        tracking_numbers: fresh.tracking_numbers || [],
        invoice_number: fresh.invoice_number || ''
      });
      setShowForm(true);
    } catch (e) {
      toast.error('Este registro ya no existe');
      loadData();
    }
  };

  const resetForm = () => {
    setForm({ cbm: '', fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm"), descripcion: '', proveedor: '', notas: '', client_email: '', client_name: '', shipping_mark: '', tracking_numbers: [], invoice_number: '' });
    setEditingId(null);
    setClientPackages([]);
  };

  const handleSubmit = async () => {
    const cbmVal = parseFloat(form.cbm);
    if (!cbmVal || cbmVal <= 0) { toast.error('Ingresa un CBM válido'); return; }
    if (!form.client_email) { toast.error('Selecciona un cliente'); return; }
    setSaving(true);
    const fechaObj = form.fecha ? new Date(form.fecha) : new Date();
    const payload = {
      fecha: fechaObj.toISOString(),
      cbm: cbmVal,
      descripcion: form.descripcion || '',
      proveedor: form.proveedor || '',
      notas: form.notas || '',
      mes: format(fechaObj, 'yyyy-MM'),
      client_email: form.client_email || '',
      client_name: form.client_name || '',
      shipping_mark: form.shipping_mark || '',
      tracking_numbers: form.tracking_numbers || [],
      invoice_number: form.invoice_number || ''
    };
    if (editingId) {
      await base44.entities.CbmIngreso.update(editingId, payload);
      toast.success('Registro actualizado');
    } else {
      await base44.entities.CbmIngreso.create(payload);
      toast.success(`${cbmVal} CBM registrados`);
    }
    resetForm();
    setShowForm(false);
    setSaving(false);
    loadData();
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.CbmIngreso.delete(id);
      toast.success('Registro eliminado');
    } catch (e) {
      toast.error('No se pudo eliminar: el registro ya no existe');
    }
    loadData();
  };

  const setQuickRange = (type) => {
    const now = new Date();
    if (type === 'thisMonth') {
      setDateFrom(format(now, 'yyyy-MM-01'));
      setDateTo(format(now, 'yyyy-MM-dd'));
    } else if (type === 'lastMonth') {
      const prev = subMonths(now, 1);
      setDateFrom(format(prev, 'yyyy-MM-01'));
      const lastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0);
      setDateTo(format(lastDay, 'yyyy-MM-dd'));
    } else if (type === 'last3') {
      setDateFrom(format(subMonths(now, 3), 'yyyy-MM-01'));
      setDateTo(format(now, 'yyyy-MM-dd'));
    } else if (type === 'last6') {
      setDateFrom(format(subMonths(now, 6), 'yyyy-MM-01'));
      setDateTo(format(now, 'yyyy-MM-dd'));
    } else if (type === 'year') {
      setDateFrom(format(now, 'yyyy') + '-01-01');
      setDateTo(format(now, 'yyyy-MM-dd'));
    }
  };

  const periodLabel = useMemo(() => {
    const from = format(new Date(dateFrom + 'T12:00:00'), 'dd MMM yyyy', { locale: es });
    const to = format(new Date(dateTo + 'T12:00:00'), 'dd MMM yyyy', { locale: es });
    return `${from} — ${to}`;
  }, [dateFrom, dateTo]);

  if (user?.role !== 'admin') {
    return <Card><CardContent className="p-8 text-center text-slate-600">Sin acceso</CardContent></Card>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHero
        icon={Package}
        badge="Almacén China"
        title="Ingresos de CBM"
        description="Registro mensual de CBM reportados desde almacén China."
        actions={
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Registrar CBM
          </Button>
        }
      />

      {/* Date range filter */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-slate-700">Filtrar por período</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setQuickRange('thisMonth')}>Este mes</Button>
            <Button variant="outline" size="sm" onClick={() => setQuickRange('lastMonth')}>Mes anterior</Button>
            <Button variant="outline" size="sm" onClick={() => setQuickRange('last3')}>Últimos 3 meses</Button>
            <Button variant="outline" size="sm" onClick={() => setQuickRange('last6')}>Últimos 6 meses</Button>
            <Button variant="outline" size="sm" onClick={() => setQuickRange('year')}>Este año</Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">{periodLabel}</p>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-sky-50">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-blue-100 rounded-2xl">
              <TrendingUp className="h-8 w-8 text-blue-700" />
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Total CBM del mes</p>
              <p className="text-3xl font-bold text-blue-900">{totalCbm.toFixed(5)}</p>
              <p className="text-xs text-blue-600">{ingresos.length} registro(s)</p>
            </div>
          </CardContent>
        </Card>
        <CbmMonthlySummary currentMonth={format(new Date(), 'yyyy-MM')} />
      </div>

      {/* Tabs: registros vs resumen por cliente */}
      <Tabs defaultValue="registros">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="registros" className="gap-2"><Package className="h-4 w-4" /> Registros</TabsTrigger>
          <TabsTrigger value="clientes" className="gap-2"><Users className="h-4 w-4" /> Por Cliente</TabsTrigger>
          <TabsTrigger value="estados" className="gap-2"><MapPin className="h-4 w-4" /> Por Estado</TabsTrigger>
        </TabsList>

        <TabsContent value="registros" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : ingresos.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-12 text-center">
                <Package className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-700">Sin registros</h3>
                <p className="text-slate-500 mt-1">No hay ingresos de CBM para este mes</p>
                <Button onClick={() => setShowForm(true)} className="mt-4 gap-2">
                  <Plus className="h-4 w-4" /> Registrar primer CBM
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {ingresos.map((item, idx) => {
                const runningTotal = ingresos.slice(0, idx + 1).reduce((s, i) => s + Number(i.cbm || 0), 0);
                return (
                  <Card key={item.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="text-center min-w-[36px]">
                          <p className="text-xs text-muted-foreground">#{ingresos.length - idx}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-blue-700">{Number(item.cbm).toFixed(5)} CBM</span>
                            {item.proveedor && <Badge variant="outline" className="text-xs">{item.proveedor}</Badge>}
                          </div>
                          {item.client_name && (
                            <p className="text-sm text-slate-700 font-medium">
                              👤 {item.client_name}
                              {item.shipping_mark && <span className="text-xs text-slate-500 ml-2 font-mono">[{item.shipping_mark}]</span>}
                            </p>
                          )}
                          {item.invoice_number && (
                            <p className="text-xs text-indigo-600 font-medium">📄 Factura: {item.invoice_number}</p>
                          )}
                          {item.tracking_numbers && item.tracking_numbers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.tracking_numbers.map(t => (
                                <span key={t} className="inline-block text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">{t}</span>
                              ))}
                            </div>
                          )}
                          {item.descripcion && <p className="text-sm text-slate-600 truncate">{item.descripcion}</p>}
                          <p className="text-xs text-muted-foreground">
                            {item.fecha ? format(new Date(item.fecha), 'dd/MM/yyyy HH:mm') : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">Acumulado</p>
                        <p className="font-semibold text-slate-800">{runningTotal.toFixed(5)}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-blue-500 hover:text-blue-700 flex-shrink-0" onClick={() => handleEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 flex-shrink-0" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="clientes" className="mt-4">
          <CbmClientSummary clientTotals={clientTotals} totalCbm={totalCbm} monthLabel={periodLabel} />
        </TabsContent>

        <TabsContent value="estados" className="mt-4">
          <CbmStateCostPanel ingresos={ingresos} />
        </TabsContent>
      </Tabs>

      {/* Form dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              {editingId ? 'Editar CBM' : 'Registrar CBM'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Client selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Cliente *</Label>
              {form.client_email ? (
                <div className="flex items-center justify-between gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <p className="font-medium text-sm text-blue-900">{form.client_name}</p>
                    <p className="text-xs text-blue-700">{form.client_email}</p>
                    {form.shipping_mark && <p className="text-xs text-blue-600 font-mono">{form.shipping_mark}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearClient} className="text-red-500 hover:text-red-700">✕</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Buscar por nombre, email o shipping mark..."
                      value={clientSearch}
                      onChange={(e) => { setClientSearch(e.target.value); searchClients(e.target.value); }}
                      className="pl-10"
                    />
                  </div>
                  {loadingClients && <p className="text-xs text-slate-500">Buscando...</p>}
                  {clients.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                      {clients.slice(0, 10).map(c => (
                        <button
                          key={c.id}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
                          onClick={() => handleSelectClient(c)}
                        >
                          <p className="text-sm font-medium">{c.first_name || ''} {c.last_name || ''}{!c.first_name && !c.last_name ? c.full_name || c.email : ''}</p>
                          <p className="text-xs text-slate-500">{c.email} {c.shipping_mark ? `· ${c.shipping_mark}` : ''}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Invoice number */}
            <div className="space-y-2">
              <Label>Número de Factura</Label>
              <Input
                placeholder="Ej: FAC-001234"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
              />
            </div>

          {/* CBM */}
          <div className="space-y-2">
            <Label>CBM *</Label>
            <Input
              type="number"
              step="0.00001"
              min="0"
              placeholder="Ej: 2.50000"
              value={form.cbm}
              onChange={(e) => setForm({ ...form, cbm: e.target.value })}
            />
          </div>

            {/* Calendar + Packages */}
            {form.client_email && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Fecha y Paquetes Recibidos</Label>
                {loadingPackages ? (
                  <p className="text-xs text-slate-500">Cargando paquetes...</p>
                ) : (
                  <CbmDatePicker
                    selectedDate={form.fecha ? new Date(form.fecha) : new Date()}
                    onDateChange={(date) => setForm({ ...form, fecha: format(date, "yyyy-MM-dd'T'HH:mm") })}
                    clientPackages={clientPackages}
                    selectedTrackings={form.tracking_numbers}
                    onTrackingsChange={(trackings) => setForm({ ...form, tracking_numbers: trackings })}
                  />
                )}
                {form.tracking_numbers.length > 0 && (
                  <p className="text-[11px] text-blue-600 font-medium">
                    {form.tracking_numbers.length} paquete(s) seleccionado(s) en total
                  </p>
                )}
              </div>
            )}

            {/* Fecha manual si no hay cliente */}
            {!form.client_email && (
              <div className="space-y-2">
                <Label>Fecha de registro *</Label>
                <Input
                  type="datetime-local"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Proveedor / Almacén</Label>
              <Input
                placeholder="Ej: Almacén Yiwu"
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? 'Guardar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}