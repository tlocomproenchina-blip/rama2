import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { fetchAllPaginated } from '@/lib/fetchAllPaginated';
import { format, subMonths, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, Package, Trash2, CalendarDays, TrendingUp, Users, Search, Filter, MapPin, Pencil, CheckSquare, Ship, MapPinned, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import CbmDatePicker from '@/components/admin/CbmDatePicker';
import { toast } from 'sonner';
import PageHero from '@/components/common/PageHero';
import CbmMonthlySummary from '@/components/accounting/CbmMonthlySummary';
import CbmClientSummary from '@/components/accounting/CbmClientSummary';
import CbmStateCostPanel from '@/components/accounting/CbmStateCostPanel';
import CbmBulkEditDialog from '@/components/admin/CbmBulkEditDialog';
import CbmImportDialog from '@/components/admin/CbmImportDialog';

export default function AdminCbmIngresos({ user }) {
  // eslint-disable-next-line no-unused-vars
  const [ingresos, setIngresos] = useState([]);
  const [allIngresos, setAllIngresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-01'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [form, setForm] = useState({ cbm: '', fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm"), descripcion: '', proveedor: '', notas: '', client_email: '', client_name: '', shipping_mark: '', tracking_numbers: [], invoice_number: '', fecha_salida: '', fecha_estimada_llegada: '', disponible_entrega: false });
  const [entries, setEntries] = useState([{ invoice_number: '', cbm: '' }]);
  const [editingId, setEditingId] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientPackages, setClientPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFrom, setOrderFrom] = useState('');
  const [orderTo, setOrderTo] = useState('');
  const [sinSalidaFilter, setSinSalidaFilter] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [syncingAccounting, setSyncingAccounting] = useState(false);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const loadData = async () => {
    setLoading(true);
    const all = await fetchAllPaginated('CbmIngreso', { sort: '-fecha' });
    setAllIngresos(all || []);
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

  // Load clients for search (con debounce para evitar ráfagas de llamadas por cada tecla)
  const searchTimeout = useRef(null);
  const searchClients = (query) => {
    clearTimeout(searchTimeout.current);
    if (!query || query.length < 2) { setClients([]); setLoadingClients(false); return; }
    setLoadingClients(true);
    searchTimeout.current = setTimeout(() => doSearchClients(query), 450);
  };

  const doSearchClients = async (query) => {
    // Usar la función backend (asServiceRole) para evitar permisos de User.list
    try {
      const res = await base44.functions.invoke('listClientsForSupport', {
        q: query,
        limit: 50,
        includeCounts: false,
      });
      const list = res?.data?.data || [];
      // Filtrar en el cliente para coincidir SOLO por shipping mark, email o nombre.
      // Evita falsos positivos donde el query coincide con whatsapp/teléfono/cédula.
      const qNorm = (query || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const qAlnum = qNorm.replace(/[^a-z0-9]/g, '');
      const filtered = list.filter((c) => {
        const email = (c.email || '').toLowerCase();
        const full = `${c.first_name || ''} ${c.last_name || ''}`.trim().toLowerCase();
        const sm = (c.shipping_mark || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (qNorm && (email.includes(qNorm) || full.includes(qNorm))) return true;
        if (qAlnum && sm.includes(qAlnum)) return true;
        return false;
      });
      setClients(filtered);
    } catch {
      setClients([]);
      toast.error('No se pudo buscar clientes. Intenta de nuevo.');
    }
    setLoadingClients(false);
  };

  // Orden descendente por número de orden (271, 270, 269...); los sin orden van al final por fecha
  const sortByOrderDesc = (list) => [...list].sort((a, b) => {
    const na = parseFloat(a.invoice_number);
    const nb = parseFloat(b.invoice_number);
    const va = Number.isFinite(na) ? na : -Infinity;
    const vb = Number.isFinite(nb) ? nb : -Infinity;
    if (vb !== va) return vb - va;
    return new Date(b.fecha || 0) - new Date(a.fecha || 0);
  });

  const filteredIngresos = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    const fromNum = orderFrom !== '' ? parseFloat(orderFrom) : null;
    const toNum = orderTo !== '' ? parseFloat(orderTo) : null;
    const hasRange = fromNum !== null || toNum !== null;
    // Cuando hay búsqueda por orden o rango, buscar en TODO el histórico, ignorando el período y el filtro de disponibilidad
    if (q || hasRange) {
      return sortByOrderDesc((allIngresos || []).filter((item) => {
        const num = parseFloat(item.invoice_number);
        if (q && !String(item.invoice_number || '').toLowerCase().includes(q)) return false;
        if (hasRange) {
          if (!Number.isFinite(num)) return false;
          if (fromNum !== null && num < fromNum) return false;
          if (toNum !== null && num > toNum) return false;
        }
        return true;
      }));
    }
    // Filtro "Sin fecha de salida": busca en TODO el histórico
    if (sinSalidaFilter) {
      return sortByOrderDesc((allIngresos || []).filter((item) => !item.fecha_salida && !item.disponible_entrega));
    }
    let result = [...ingresos];
    if (availabilityFilter === 'available') {
      result = result.filter((item) => !!item.disponible_entrega);
    } else if (availabilityFilter === 'unavailable') {
      result = result.filter((item) => !item.disponible_entrega);
    }
    return sortByOrderDesc(result);
  }, [ingresos, allIngresos, availabilityFilter, orderSearch, orderFrom, orderTo, sinSalidaFilter]);

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

  // Carga los paquetes recibidos del cliente, excluyendo los ya usados en otros CbmIngreso.
  // Incluye también los paquetes cuyos trackings ya están en el registro que se está editando.
  const loadClientPackages = async (email, options = {}) => {
    const { editingRecordId = null, currentTrackings = [] } = options;
    setLoadingPackages(true);
    try {
      const [pkgs, allCbm] = await Promise.all([
        base44.entities.Package.filter({ client_email: email, status: 'recibido' }, '-received_date', 200),
        base44.entities.CbmIngreso.filter({ client_email: email }, '-fecha', 500)
      ]);
      // Trackings usados en otros registros (no en el que se edita)
      const usedTrackings = new Set();
      (allCbm || []).forEach(cbm => {
        if (editingRecordId && cbm.id === editingRecordId) return;
        (cbm.tracking_numbers || []).forEach(t => usedTrackings.add(t));
      });
      const currentSet = new Set(currentTrackings || []);
      const available = (pkgs || []).filter(p => !usedTrackings.has(p.tracking_number) || currentSet.has(p.tracking_number));
      setClientPackages(available);
    } catch { setClientPackages([]); }
    setLoadingPackages(false);
  };

  const handleSelectClient = async (client) => {
    setForm({
      ...form,
      client_email: client.email,
      client_name: `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.full_name || client.email,
      shipping_mark: client.shipping_mark || ''
    });
    setClientSearch('');
    setClients([]);
    await loadClientPackages(client.email, { editingRecordId: editingId });
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
        invoice_number: fresh.invoice_number || '',
        fecha_salida: fresh.fecha_salida || '',
        fecha_estimada_llegada: fresh.fecha_estimada_llegada || '',
        disponible_entrega: !!fresh.disponible_entrega
      });
      setEntries([{ invoice_number: fresh.invoice_number || '', cbm: String(fresh.cbm || '') }]);
      setShowForm(true);
      // Cargar paquetes recibidos del cliente para poder ver/seleccionar trackings al editar
      if (fresh.client_email) {
        await loadClientPackages(fresh.client_email, { editingRecordId: fresh.id, currentTrackings: fresh.tracking_numbers || [] });
      }
    } catch (e) {
      toast.error('Este registro ya no existe');
      loadData();
    }
  };

  const resetForm = () => {
    setForm({ cbm: '', fecha: format(new Date(), "yyyy-MM-dd'T'HH:mm"), descripcion: '', proveedor: '', notas: '', client_email: '', client_name: '', shipping_mark: '', tracking_numbers: [], invoice_number: '', fecha_salida: '', fecha_estimada_llegada: '', disponible_entrega: false });
    setEntries([{ invoice_number: '', cbm: '' }]);
    setEditingId(null);
    setClientPackages([]);
  };

  const addEntry = () => setEntries([...entries, { invoice_number: '', cbm: '' }]);
  const removeEntry = (idx) => setEntries(entries.filter((_, i) => i !== idx));
  const updateEntry = (idx, field, value) => setEntries(entries.map((e, i) => i === idx ? { ...e, [field]: value } : e));

  const handleSubmit = async () => {
    if (!form.client_email) { toast.error('Selecciona un cliente'); return; }
    setSaving(true);

    const fechaObj = form.fecha ? new Date(form.fecha) : new Date();
    const basePayload = {
      fecha: fechaObj.toISOString(),
      descripcion: form.descripcion || '',
      proveedor: form.proveedor || '',
      notas: form.notas || '',
      mes: format(fechaObj, 'yyyy-MM'),
      client_email: form.client_email || '',
      client_name: form.client_name || '',
      shipping_mark: form.shipping_mark || '',
      fecha_salida: form.fecha_salida || '',
      fecha_estimada_llegada: form.fecha_estimada_llegada || '',
      disponible_entrega: !!form.disponible_entrega
    };

    try {
      if (editingId) {
        // Edit mode: single record
        const cbmVal = parseFloat(form.cbm);
        if (!cbmVal || cbmVal <= 0) { toast.error('Ingresa un CBM válido'); setSaving(false); return; }
        const orderNum = String(form.invoice_number || '').trim();
        if (orderNum) {
          const dup = (allIngresos || []).find((i) =>
            i.id !== editingId &&
            String(i.invoice_number || '').trim().toLowerCase() === orderNum.toLowerCase()
          );
          if (dup) {
            toast.error(`El número de orden ${orderNum} ya está registrado (${dup.client_name || dup.client_email || 'otro registro'}).`);
            setSaving(false);
            return;
          }
        }
        await base44.entities.CbmIngreso.update(editingId, {
          ...basePayload,
          cbm: cbmVal,
          tracking_numbers: form.tracking_numbers || [],
          invoice_number: form.invoice_number || ''
        });
        toast.success('Registro actualizado');
      } else {
        // Create mode: multiple entries
        const validEntries = entries.filter(e => parseFloat(e.cbm) > 0);
        if (validEntries.length === 0) { toast.error('Agrega al menos una fila con CBM válido'); setSaving(false); return; }

        // Validar duplicados de orden dentro del lote
        const seenOrders = new Set();
        for (const e of validEntries) {
          const orderNum = String(e.invoice_number || '').trim().toLowerCase();
          if (orderNum) {
            if (seenOrders.has(orderNum)) {
              toast.error(`Número de orden duplicado en la lista: ${e.invoice_number}`);
              setSaving(false);
              return;
            }
            seenOrders.add(orderNum);
          }
        }

        // Validar duplicados contra registros existentes
        for (const e of validEntries) {
          const orderNum = String(e.invoice_number || '').trim();
          if (orderNum) {
            const dup = (allIngresos || []).find((i) =>
              String(i.invoice_number || '').trim().toLowerCase() === orderNum.toLowerCase()
            );
            if (dup) {
              toast.error(`Orden ${orderNum} ya existe (${dup.client_name || dup.client_email}).`);
              setSaving(false);
              return;
            }
          }
        }

        // Cuando hay una sola fila, asignar tracking_numbers; con múltiples, no se asignan
        const sharedTrackings = validEntries.length === 1 ? (form.tracking_numbers || []) : [];
        const records = validEntries.map(e => ({
          ...basePayload,
          cbm: parseFloat(e.cbm),
          invoice_number: String(e.invoice_number || '').trim(),
          tracking_numbers: sharedTrackings
        }));

        if (records.length === 1) {
          await base44.entities.CbmIngreso.create(records[0]);
        } else {
          await base44.entities.CbmIngreso.bulkCreate(records);
        }
        const totalCbm = records.reduce((s, r) => s + r.cbm, 0);
        toast.success(`${records.length} registro(s) creado(s) · ${totalCbm.toFixed(5)} CBM total`);
      }
      resetForm();
      setShowForm(false);
    } catch (e) {
      toast.error('Error al guardar: ' + (e?.message || ''));
    }
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

  // Corrida de conciliación: el almacén de Venezuela es la fuente definitiva, así que
  // sus bultos alinean los recibos de contabilidad (N° de orden, CBM y paquetes).
  const handleSyncFromWarehouse = async () => {
    setSyncingAccounting(true);
    const totals = { updated: 0, created: 0, matched: 0, without_match: 0 };
    const warnings = [];
    try {
      let offset = 0;
      for (let i = 0; i < 40; i++) {
        const res = await base44.functions.invoke('syncBultosToAccounting', { offset, batch_size: 25 });
        const data = res?.data || {};
        if (data.error) { toast.error(data.error); break; }
        totals.updated += data.updated || 0;
        totals.created += data.created || 0;
        totals.matched += data.matched || 0;
        totals.without_match += data.without_match || 0;
        if (data.warnings?.length) warnings.push(...data.warnings);
        if (!data.has_more) break;
        offset = data.next_offset || offset + 25;
      }
      toast.success(`Conciliación lista: ${totals.updated} recibo(s) actualizado(s), ${totals.created} creado(s), ${totals.matched} ya alineado(s), ${totals.without_match} sin coincidencia`);
      if (warnings.length) toast.warning(warnings[0]);
      loadData();
    } catch (e) {
      toast.error('No se pudo conciliar con el almacén');
    }
    setSyncingAccounting(false);
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleSyncFromWarehouse} disabled={syncingAccounting} className="gap-2">
              {syncingAccounting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Conciliar con almacén
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Importar Excel
            </Button>
            <Button onClick={() => setShowForm(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Registrar CBM
            </Button>
          </div>
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

        <TabsContent value="registros" className="mt-4 space-y-3">
          {!loading && allIngresos.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por número de orden (ej: 238)..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min="0"
                  placeholder="Desde"
                  value={orderFrom}
                  onChange={(e) => setOrderFrom(e.target.value)}
                  className="w-24"
                />
                <span className="text-xs text-slate-400">al</span>
                <Input
                  type="number"
                  min="0"
                  placeholder="Hasta"
                  value={orderTo}
                  onChange={(e) => setOrderTo(e.target.value)}
                  className="w-24"
                />
                {(orderFrom !== '' || orderTo !== '') && (
                  <Button variant="ghost" size="sm" onClick={() => { setOrderFrom(''); setOrderTo(''); }} className="text-slate-500 hover:text-slate-700 px-2">
                    ✕
                  </Button>
                )}
              </div>
            </div>
          )}
          {(orderSearch.trim() || orderFrom !== '' || orderTo !== '') && (
            <p className="text-xs text-slate-500">
              Buscando en todo el histórico · {filteredIngresos.length} resultado(s)
            </p>
          )}
          {!loading && !orderSearch.trim() && orderFrom === '' && orderTo === '' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Despacho:</span>
              <Button variant={availabilityFilter === 'all' ? 'secondary' : 'outline'} size="sm" onClick={() => setAvailabilityFilter('all')}>Todos</Button>
              <Button variant={availabilityFilter === 'available' ? 'secondary' : 'outline'} size="sm" onClick={() => setAvailabilityFilter('available')} className="gap-1"><CheckSquare className="h-3.5 w-3.5" /> Disponibles</Button>
              <Button variant={availabilityFilter === 'unavailable' ? 'secondary' : 'outline'} size="sm" onClick={() => setAvailabilityFilter('unavailable')}>No disponibles</Button>
              <Button
                variant={sinSalidaFilter ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setSinSalidaFilter(!sinSalidaFilter)}
                className={`gap-1 ${sinSalidaFilter ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : ''}`}
              >
                <Ship className="h-3.5 w-3.5" /> Sin fecha de salida
              </Button>
            </div>
          )}
          {sinSalidaFilter && !orderSearch.trim() && orderFrom === '' && orderTo === '' && (
            <p className="text-xs text-amber-700 font-medium">
              Mostrando todas las órdenes sin fecha de salida (histórico completo) · {filteredIngresos.length} registro(s)
            </p>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : ingresos.length === 0 && !orderSearch.trim() && orderFrom === '' && orderTo === '' && !sinSalidaFilter ? (
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
          ) : filteredIngresos.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center text-slate-500">
                Sin registros para este filtro
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Selection bar */}
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all-cbm"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredIngresos.length}
                    onCheckedChange={(c) => setSelectedIds(c ? filteredIngresos.map(i => i.id) : [])}
                  />
                  <Label htmlFor="select-all-cbm" className="text-xs text-slate-600 cursor-pointer">
                    {selectedIds.length > 0 ? `${selectedIds.length} seleccionado(s)` : 'Seleccionar todos'}
                  </Label>
                </div>
                {selectedIds.length > 0 && (
                  <Button size="sm" onClick={() => setShowBulkEdit(true)} className="gap-2">
                    <Pencil className="h-4 w-4" /> Editar seleccionados
                  </Button>
                )}
              </div>
              {filteredIngresos.map((item, idx) => {
                const runningTotal = filteredIngresos.slice(0, idx + 1).reduce((s, i) => s + Number(i.cbm || 0), 0);
                return (
                  <Card key={item.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 overflow-hidden">
                      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          className="flex-shrink-0"
                        />
                        <div className="text-center min-w-[36px]">
                          <p className="text-xs text-muted-foreground">
                            {`#${filteredIngresos.length - idx}`}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-blue-700">{Number(item.cbm).toFixed(5)} CBM</span>
                            {item.proveedor && <Badge variant="outline" className="text-xs">{item.proveedor}</Badge>}
                          </div>
                          {item.client_name && (
                            <p className="text-sm text-slate-700 font-medium">
                              👤 {item.client_name}
                              {item.shipping_mark && <span className="text-xs text-slate-500 ml-2 font-mono break-all">[{item.shipping_mark}]</span>}
                            </p>
                          )}
                          {item.invoice_number && (
                            <p className="text-xs text-indigo-600 font-medium">📄 Orden N: {item.invoice_number}</p>
                          )}
                          {Number(item.package_count || 0) > 0 && (
                            <p className="text-xs text-slate-500">{Number(item.package_count)} paquete(s) según almacén Venezuela</p>
                          )}
                          {item.ve_synced_date && (
                            <p className="text-[11px] text-emerald-600">
                              Actualizado desde almacén Venezuela · {format(new Date(item.ve_synced_date), 'dd/MM/yyyy HH:mm')}
                              {item.ve_synced_by ? ` · ${item.ve_synced_by}` : ''}
                              {item.ve_synced_bulto_label ? ` · bulto ${item.ve_synced_bulto_label}` : ''}
                            </p>
                          )}
                          {item.tracking_numbers && item.tracking_numbers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.tracking_numbers.map(t => (
                                <span key={t} className="inline-block text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono break-all">{t}</span>
                              ))}
                            </div>
                          )}
                          {item.descripcion && <p className="text-sm text-slate-600 truncate">{item.descripcion}</p>}
                          <p className="text-xs text-muted-foreground">
                            {item.fecha ? format(new Date(item.fecha), 'dd/MM/yyyy HH:mm') : '—'}
                          </p>
                          {item.fecha_salida && (
                            <p className="text-xs text-emerald-600 flex items-center gap-1">
                              <Ship className="h-3 w-3" />
                              Salida: {item.fecha_salida}
                              {item.fecha_estimada_llegada && <span className="text-slate-500 ml-1">· Llegada est.: {item.fecha_estimada_llegada}</span>}
                            </p>
                          )}
                          {item.disponible_entrega && (
                            <Badge className="mt-1 text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold w-fit">
                              ✓ Disponible para entrega
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t pt-2 sm:border-t-0 sm:pt-0 sm:flex-shrink-0">
                        <div className="text-left sm:text-right">
                          <p className="text-xs text-muted-foreground">Acumulado</p>
                          <p className="font-semibold text-slate-800">{runningTotal.toFixed(5)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="text-blue-500 hover:text-blue-700 flex-shrink-0" onClick={() => handleEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 flex-shrink-0" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
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

      {/* Bulk edit dialog */}
      <CbmBulkEditDialog
        open={showBulkEdit}
        onOpenChange={setShowBulkEdit}
        selectedIds={selectedIds}
        onDone={() => { setSelectedIds([]); loadData(); }}
      />

      {/* Import Excel dialog */}
      <CbmImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onDone={() => loadData()}
      />

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

            {/* Invoice number + CBM: lista múltiple (crear) o campos simples (editar) */}
            {editingId ? (
              <>
                <div className="space-y-2">
                  <Label>Número de Orden</Label>
                  <Input
                    placeholder="Ej: ORD-001234"
                    value={form.invoice_number}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                  />
                </div>
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
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Órdenes y CBM *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addEntry} className="gap-1 h-7">
                    <Plus className="h-3.5 w-3.5" /> Agregar fila
                  </Button>
                </div>
                <div className="space-y-2">
                  {entries.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder="N° de Orden (ej: ORD-001234)"
                          value={entry.invoice_number}
                          onChange={(e) => updateEntry(idx, 'invoice_number', e.target.value)}
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          step="0.00001"
                          min="0"
                          placeholder="CBM"
                          value={entry.cbm}
                          onChange={(e) => updateEntry(idx, 'cbm', e.target.value)}
                        />
                      </div>
                      {entries.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700 flex-shrink-0" onClick={() => removeEntry(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {entries.length > 1 && (
                  <p className="text-[11px] text-blue-600 font-medium">
                    {entries.filter(e => parseFloat(e.cbm) > 0).length} fila(s) válida(s) · Se creará un registro por cada fila
                  </p>
                )}
              </div>
            )}

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
                    {form.tracking_numbers.length} paquete(s) seleccionado(s)
                    {!editingId && entries.filter(e => parseFloat(e.cbm) > 0).length > 1 && ' (solo se asignan si hay una sola fila)'}
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

            {/* Fecha de salida + Estimada de llegada */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Ship className="h-4 w-4" /> Fecha de salida</Label>
              <Input
                type="date"
                value={form.fecha_salida}
                onChange={(e) => {
                  const salida = e.target.value;
                  const llegada = salida ? format(addDays(new Date(salida + 'T12:00:00'), 90), 'yyyy-MM-dd') : '';
                  setForm({ ...form, fecha_salida: salida, fecha_estimada_llegada: llegada });
                }}
              />
            </div>
            {form.fecha_salida && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><MapPinned className="h-4 w-4" /> Fecha estimada de llegada</Label>
                <Input
                  type="date"
                  value={form.fecha_estimada_llegada}
                  onChange={(e) => setForm({ ...form, fecha_estimada_llegada: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">Calculado automáticamente: fecha de salida + 90 días</p>
              </div>
            )}

            {/* Disponible para entrega */}
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <Checkbox
                id="disponible-entrega"
                checked={!!form.disponible_entrega}
                onCheckedChange={(checked) => setForm({ ...form, disponible_entrega: !!checked })}
              />
              <Label htmlFor="disponible-entrega" className="cursor-pointer text-sm font-medium text-emerald-800">
                Disponible para entrega
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Proveedor / Almacén</Label>
              <Input
                placeholder="Ej: Almacén Guangdong"
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
              {editingId ? 'Guardar' : `Registrar${!editingId && entries.filter(e => parseFloat(e.cbm) > 0).length > 1 ? ` (${entries.filter(e => parseFloat(e.cbm) > 0).length})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}