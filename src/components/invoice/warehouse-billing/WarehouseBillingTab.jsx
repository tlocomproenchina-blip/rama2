import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Search, Users, Package, Boxes, DollarSign, AlertCircle, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import WarehouseBillingList from './WarehouseBillingList';
import WarehouseBillingClientDetail from './WarehouseBillingClientDetail';
import { buildBillingContext, computeClientEstimate, num } from '@/lib/warehouseBilling';
import { matchesBultoCode } from '@/lib/bultoSearch';

const money = (v) => `$${Number(v || 0).toFixed(2)}`;

function MetricCard({ icon: Icon, label, value, tone }) {
  return (
    <Card className="border-border/70 shadow-card">
      <CardContent className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-semibold text-slate-800 truncate">{value}</p>
        </div>
        <Icon className={`h-6 w-6 shrink-0 ${tone}`} />
      </CardContent>
    </Card>
  );
}

export default function WarehouseBillingTab({ search = '' }) {
  const [clients, setClients] = useState([]);
  const [config, setConfig] = useState({ appConfig: null, pricing: null, stateConfigs: [], rateHistory: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localSearch, setLocalSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [loadingDates, setLoadingDates] = useState(false);

  // Corrección de una sola pasada: los bultos que sí tienen registro de escaneo
  // reciben su fecha real de reconocimiento en el almacén de Venezuela.
  const handleLoadDates = async () => {
    setLoadingDates(true);
    try {
      const res = await base44.functions.invoke('backfillBultoVeRecognizedDates', {});
      const data = res?.data || {};
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`${data.updated || 0} bulto(s) recibieron su fecha real de escaneo`);
        await load(false);
      }
    } catch (e) {
      toast.error('No se pudieron cargar las fechas de reconocimiento');
    }
    setLoadingDates(false);
  };

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const [res, cfgs, prc, states, history] = await Promise.all([
        base44.functions.invoke('getWarehouseBillingClients', {}),
        base44.entities.AppConfig.filter({ config_key: 'main' }).catch(() => []),
        base44.entities.PricingConfig.filter({ config_key: 'main' }).catch(() => []),
        base44.entities.StateConfig.list('-updated_date', 100).catch(() => []),
        base44.entities.RateHistory.list('-effective_date', 200).catch(() => []),
      ]);
      setClients(res?.data?.clients || []);
      setConfig({
        appConfig: cfgs?.[0] || null,
        pricing: prc?.[0] || null,
        stateConfigs: states || [],
        rateHistory: history || [],
      });
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la carga en almacén');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Monto estimado por cliente con las tarifas vigentes
  const enriched = useMemo(() => clients.map((c) => {
    const ctx = buildBillingContext({
      pricing: config.pricing,
      appConfig: config.appConfig,
      stateConfigs: config.stateConfigs,
      rateHistory: config.rateHistory,
      clientState: c.state,
    });
    return { ...c, ctx, estimate: computeClientEstimate(c, ctx) };
  }), [clients, config]);

  const states = useMemo(
    () => [...new Set(enriched.map((c) => String(c.state || '').toLowerCase()).filter(Boolean))].sort(),
    [enriched]
  );

  const term = String(localSearch || search || '').toLowerCase();
  const filtered = useMemo(() => enriched.filter((c) => {
    const matchesState = stateFilter === 'all' || String(c.state || '').toLowerCase() === stateFilter;
    if (!matchesState) return false;
    if (!term) return true;
    const haystack = [
      c.client_name, c.client_email, c.cedula, c.shipping_mark, c.city, c.state, c.whatsapp,
      ...c.bultos.map((b) => b.label), ...c.bultos.flatMap((b) => b.order_numbers || []),
      ...c.bultos.flatMap((b) => b.trackings || []),
      ...c.receipts.map((r) => r.label), ...c.receipts.flatMap((r) => r.trackings || []),
    ].filter(Boolean).join(' ').toLowerCase();
    if (haystack.includes(term)) return true;
    // Los últimos caracteres del código de bulto bastan para encontrar la carga.
    return [...c.bultos.map((b) => b.label), ...c.receipts.map((r) => r.label)]
      .some((label) => matchesBultoCode(label, term));
  }), [enriched, term, stateFilter]);

  const summary = useMemo(() => ({
    clients: filtered.length,
    bultos: filtered.reduce((s, c) => s + num(c.totals.bultos), 0),
    cbm: filtered.reduce((s, c) => s + num(c.totals.cbm), 0),
    total: filtered.reduce((s, c) => s + num(c.estimate.total), 0),
  }), [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-border/70 shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-rose-400 mb-3" />
          <p className="text-rose-600 font-medium">No se pudo cargar la carga en almacén</p>
          <p className="text-sm text-slate-500 mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => load()}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  if (selected) {
    return (
      <WarehouseBillingClientDetail
        client={selected}
        ctx={selected.ctx}
        appConfig={config.appConfig}
        onBack={() => setSelected(null)}
        onGenerated={() => load(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Carga en almacén pendiente de facturar</h2>
          <p className="text-sm text-slate-500">
            Bultos en almacén de Venezuela y contenedores/recibos de CBM sin facturar, agrupados por cliente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleLoadDates} disabled={loadingDates}>
            {loadingDates ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-2" />}
            {loadingDates ? 'Cargando fechas…' : 'Cargar fechas de reconocimiento'}
          </Button>
          <Button variant="outline" onClick={() => load()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Users} label="Clientes con carga" value={summary.clients} tone="text-primary" />
        <MetricCard icon={Package} label="Bultos en almacén" value={summary.bultos} tone="text-primary" />
        <MetricCard icon={Boxes} label="CBM total" value={Number(summary.cbm || 0).toFixed(4)} tone="text-primary" />
        <MetricCard icon={DollarSign} label="Monto estimado" value={money(summary.total)} tone="text-emerald-600" />
      </div>

      <Card className="border-border/70 shadow-card">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Buscar por cliente, email, shipping mark, N° de contenedor, tracking o últimos caracteres del código..."
              className="pl-9"
            />
          </div>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {states.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <WarehouseBillingList clients={filtered} onOpen={setSelected} />
    </div>
  );
}