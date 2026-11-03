import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, Package, Boxes, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import AnalyticsSummaryCards from '@/components/client-analytics/AnalyticsSummaryCards';
import MonthlySpendChart from '@/components/client-analytics/MonthlySpendChart';
import ShippingCostBreakdownChart from '@/components/client-analytics/ShippingCostBreakdownChart';
import ConsolidationEfficiencyChart from '@/components/client-analytics/ConsolidationEfficiencyChart';
import ClientAnalyticsSearch from '@/components/client-analytics/ClientAnalyticsSearch';
import ClientProfileCard from '@/components/client-analytics/ClientProfileCard';
import ClientStateRatesCard from '@/components/manual-billing/ClientStateRatesCard';
import ClientPackagesTable from '@/components/client-analytics/ClientPackagesTable';
import ClientCbmHistory from '@/components/client-analytics/ClientCbmHistory';
import ClientInvoicesList from '@/components/client-analytics/ClientInvoicesList';
import ClientCargoPanel from '@/components/client-cargo/ClientCargoPanel';
import ClientGuidesPanel from '@/components/client-cargo/ClientGuidesPanel';
import Client360DispatchOrders from '@/components/support/client360/Client360DispatchOrders';
import { billableTotal } from '@/lib/storageLines';

function getLastMonths(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('es-VE', { month: 'short', year: '2-digit' })
    };
  });
}

function normalizePercent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

export default function ClientAnalytics() {
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [consolidations, setConsolidations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoicePayments, setInvoicePayments] = useState([]);
  const [packages, setPackages] = useState([]);
  const [insurancePayments, setInsurancePayments] = useState([]);
  const [cbmIngresos, setCbmIngresos] = useState([]);
  const [dispatchOrders, setDispatchOrders] = useState([]);
  const [dispatchError, setDispatchError] = useState(false);
  const [appConfig, setAppConfig] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [stateConfigs, setStateConfigs] = useState([]);

  // Preselección de cliente si viene ?q= o ?email= en la URL.
  // Usamos getClientsByEmails (sin filtro de rol) para que siempre encuentre
  // al cliente sin importar su custom_role, y reactivo al parámetro para que
  // funcione incluso si ya estabas en esta página.
  const [searchParams] = useSearchParams();
  const urlEmail = (searchParams.get('q') || searchParams.get('email') || '').trim();

  const loadClientFromUrl = async (email) => {
    if (!email) {
      setLoadingClients(false);
      return;
    }
    try {
      setLoadingClients(true);
      const res = await base44.functions.invoke('getClientsByEmails', { emails: [email] });
      const match = res?.data?.clients?.[email];
      if (match) {
        setSelectedClient(match);
      } else {
        toast.error('No se encontró el cliente');
      }
    } catch {
      toast.error('No se pudo cargar el cliente');
    }
    setLoadingClients(false);
  };

  const loadData = async (clientEmail) => {
    if (!clientEmail) {
      setConsolidations([]);
      setInvoices([]);
      setInvoicePayments([]);
      setPackages([]);
      setInsurancePayments([]);
      setCbmIngresos([]);
      setDispatchOrders([]);
      return;
    }

    setLoading(true);
    setDispatchError(false);
    // Cada bloque carga por separado: si uno falla, los demás siguen mostrándose.
    const failed = [];
    const safe = (label, promise) => promise.catch(() => { failed.push(label); return null; });
    const [consolidationList, invoiceList, paymentList, packageList, cbmList, dispatchList, insuranceList] = await Promise.all([
      safe('consolidaciones', base44.entities.Consolidation.filter({ client_email: clientEmail }, '-created_date', 500)),
      safe('facturas', base44.entities.Invoice.filter({ client_email: clientEmail }, '-created_date', 500)),
      safe('abonos', base44.entities.InvoicePayment.filter({ client_email: clientEmail }, '-created_date', 500)),
      safe('paquetes', base44.entities.Package.filter({ client_email: clientEmail }, '-created_date', 1000)),
      safe('recibos', base44.entities.CbmIngreso.filter({ client_email: clientEmail }, '-fecha', 500)),
      safe('órdenes de despacho', base44.entities.DispatchOrder.filter({ client_email: clientEmail }, '-created_date', 500)),
      safe('seguros', base44.entities.InsurancePayment.filter({ client_email: clientEmail }, '-created_date', 500))
    ]);
    setConsolidations(consolidationList || []);
    setInvoices(invoiceList || []);
    setInvoicePayments(paymentList || []);
    setPackages(packageList || []);
    setInsurancePayments(insuranceList || []);
    setCbmIngresos(cbmList || []);
    setDispatchOrders(dispatchList || []);
    setDispatchError(dispatchList === null);
    if (failed.length) toast.error(`No se pudo cargar: ${failed.join(', ')}. Pulsa Actualizar para reintentar.`);
    setLoading(false);
  };

  // Refresca solo lo financiero después de registrar un abono: las facturas (saldo
  // y estado) y los abonos del cliente, sin volver a traer toda la analítica.
  const refreshFinancials = async () => {
    const email = selectedClient?.email;
    if (!email) return;
    // El abono se guarda y se aprueba fuera de la caché de consultas: se invalida
    // para que la lectura traiga el saldo y los abonos recién actualizados.
    base44.invalidateEntityCache('Invoice');
    base44.invalidateEntityCache('InvoicePayment');
    try {
      const [invoiceList, paymentList] = await Promise.all([
        base44.entities.Invoice.filter({ client_email: email }, '-created_date', 500),
        base44.entities.InvoicePayment.filter({ client_email: email }, '-created_date', 500).catch(() => [])
      ]);
      setInvoices(invoiceList || []);
      setInvoicePayments(paymentList || []);
    } catch {
      toast.error('No se pudieron actualizar las facturas y abonos');
    }
  };

  useEffect(() => {
    loadClientFromUrl(urlEmail);
  }, [urlEmail]);

  useEffect(() => {
    (async () => {
      const [cfgs, prc, states] = await Promise.all([
        base44.entities.AppConfig.filter({ config_key: 'main' }).catch(() => []),
        base44.entities.PricingConfig.filter({ config_key: 'main' }).catch(() => []),
        base44.entities.StateConfig.list('-updated_date', 100).catch(() => [])
      ]);
      setAppConfig(cfgs?.[0] || null);
      setPricing(prc?.[0] || null);
      setStateConfigs(states || []);
    })();
  }, []);

  useEffect(() => {
    loadData(selectedClient?.email);
  }, [selectedClient?.email]);

  const analytics = useMemo(() => {
    const months = getLastMonths(6);
    const monthlySpendMap = new Map(months.map((item) => [item.key, { ...item, amount: 0 }]));
    invoices.filter((invoice) => invoice.status !== 'cancelada').forEach((invoice) => {
      const date = new Date(invoice.invoice_date || invoice.created_date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlySpendMap.has(key)) monthlySpendMap.get(key).amount += billableTotal(invoice);
    });

    const shipmentCostHistory = consolidations.slice(0, 8).reverse().map((item, index) => ({
      label: item.consolidation_tracking || `Cons. ${index + 1}`,
      shipping: Number(item.shipping_cost || 0),
      insurance: Number(item.insurance_cost || 0),
      total: Number(item.total_cost || 0)
    }));

    const totalConsolidations = consolidations.length;
    const deliveredConsolidations = consolidations.filter((item) => item.status === 'entregado').length;
    const payableConsolidations = consolidations.filter((item) => Number(item.total_cost || 0) > 0);
    const insuredConsolidations = consolidations.filter((item) => Number(item.insurance_cost || 0) > 0).length;

    const totalSpend = invoices.filter((invoice) => invoice.status !== 'cancelada').reduce((sum, invoice) => sum + billableTotal(invoice), 0);
    const monthlyAverage = totalConsolidations ? totalSpend / Math.max(months.length, 1) : 0;
    const averageShipmentCost = payableConsolidations.length ? payableConsolidations.reduce((sum, item) => sum + Number(item.total_cost || 0), 0) / payableConsolidations.length : 0;
    const billableWeights = consolidations.filter((item) => Number(item.billable_weight || 0) > 0);
    const averageBillableWeight = billableWeights.length ? billableWeights.reduce((sum, item) => sum + Number(item.billable_weight || 0), 0) / billableWeights.length : 0;

    const efficiencyData = [
      { metric: 'Entrega', value: normalizePercent(totalConsolidations ? (deliveredConsolidations / totalConsolidations) * 100 : 0) },
      { metric: 'Seguro', value: normalizePercent(totalConsolidations ? (insuredConsolidations / totalConsolidations) * 100 : 0) },
      { metric: 'Costo promedio', value: normalizePercent(averageShipmentCost ? Math.min((averageShipmentCost / 500) * 100, 100) : 0) },
      { metric: 'Peso facturable', value: normalizePercent(averageBillableWeight ? Math.min((averageBillableWeight / 100) * 100, 100) : 0) }
    ];

    return {
      monthlySpend: Array.from(monthlySpendMap.values()),
      shipmentCostHistory,
      efficiencyData,
      totals: {
        totalSpend,
        monthlyAverage,
        totalConsolidations,
        averageShipmentCost
      }
    };
  }, [consolidations, invoices]);

  if (loadingClients) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Analítica de clientes</h1>
          <p className="text-slate-500">Busca un cliente y visualiza su gasto, costos de envío y desempeño de consolidaciones.</p>
        </div>
        <Button variant="outline" onClick={() => loadData(selectedClient?.email)} disabled={!selectedClient || loading}>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </Button>
      </div>

      <ClientAnalyticsSearch
        selectedClient={selectedClient}
        onSelectClient={setSelectedClient}
      />

      {!selectedClient && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-10 text-center text-slate-500">
            Selecciona un cliente en el buscador para ver su analítica.
          </CardContent>
        </Card>
      )}

      {selectedClient && <ClientProfileCard client={selectedClient} />}

      {selectedClient && (
        <ClientStateRatesCard
          client={selectedClient}
          stateConfigs={stateConfigs}
          appConfig={appConfig}
          pricing={pricing}
        />
      )}

      {selectedClient && <AnalyticsSummaryCards items={[
        {
          title: 'Consumo total',
          value: `$${analytics.totals.totalSpend.toFixed(2)}`,
          subtitle: 'Facturación acumulada',
          icon: DollarSign,
          accent: 'bg-emerald-100 text-emerald-700'
        },
        {
          title: 'Promedio mensual',
          value: `$${analytics.totals.monthlyAverage.toFixed(2)}`,
          subtitle: 'Últimos 6 meses',
          icon: TrendingUp,
          accent: 'bg-blue-100 text-blue-700'
        },
        {
          title: 'Consolidaciones',
          value: String(analytics.totals.totalConsolidations),
          subtitle: 'Histórico total',
          icon: Boxes,
          accent: 'bg-purple-100 text-purple-700'
        },
        {
          title: 'Costo promedio',
          value: `$${analytics.totals.averageShipmentCost.toFixed(2)}`,
          subtitle: 'Por consolidación',
          icon: Package,
          accent: 'bg-amber-100 text-amber-700'
        }
      ]} />}

      {selectedClient && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <MonthlySpendChart data={analytics.monthlySpend} />
          <ConsolidationEfficiencyChart data={analytics.efficiencyData} />
        </div>
      )}

      {selectedClient && <ShippingCostBreakdownChart data={analytics.shipmentCostHistory} />}

      {selectedClient && (
        <ClientCbmHistory
          ingresos={cbmIngresos}
          totalCbm={cbmIngresos.reduce((s, i) => s + Number(i.cbm || 0), 0)}
          client={selectedClient}
          dispatchOrders={dispatchOrders}
          onRefresh={() => loadData(selectedClient?.email)}
        />
      )}

      {selectedClient && (
        <ClientInvoicesList
          invoices={invoices}
          payments={invoicePayments}
          client={selectedClient}
          onPaymentSaved={refreshFinancials}
        />
      )}

      {selectedClient && <ClientCargoPanel client={selectedClient} />}

      {selectedClient && <ClientGuidesPanel client={selectedClient} />}

      {selectedClient && (
        <Card className="border-0 shadow-sm">
          {loading && dispatchOrders.length === 0 ? (
            <CardContent className="p-4 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando órdenes de despacho…
            </CardContent>
          ) : dispatchError ? (
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-rose-600">No se pudieron cargar las órdenes de despacho.</p>
              <Button size="sm" variant="outline" onClick={() => loadData(selectedClient?.email)}>Reintentar</Button>
            </CardContent>
          ) : dispatchOrders.length === 0 ? (
            <CardContent className="p-4">
              <p className="text-sm text-slate-400 bg-slate-50 rounded-lg px-4 py-3">Este cliente no tiene órdenes de despacho registradas.</p>
            </CardContent>
          ) : (
            <Client360DispatchOrders orders={dispatchOrders} />
          )}
        </Card>
      )}

      {selectedClient && (
        <ClientPackagesTable
          packages={packages}
          client={selectedClient}
          cbmIngresos={cbmIngresos}
          insurancePayments={insurancePayments}
          onPackageReceived={(pkgId, patch) => {
            setPackages((prev) => prev.map((p) => p.id === pkgId ? { ...p, ...patch } : p));
          }}
        />
      )}

      {selectedClient && analytics.shipmentCostHistory.length === 0 && !loading && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-10 text-center text-slate-500">Aún no hay suficientes datos para mostrar analítica histórica.</CardContent>
        </Card>
      )}
    </div>
  );
}