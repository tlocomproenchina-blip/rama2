import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { toRows } from '@/lib/wholesalerScope';
import WholesalerSourceList from './WholesalerSourceList';
import WholesalerAuditDetail from './WholesalerAuditDetail';
import WholesalerUniversalSearch from './WholesalerUniversalSearch';
import WholesalerManualInvoiceForm from './WholesalerManualInvoiceForm';
import WholesalerInvoiceTable from './WholesalerInvoiceTable';
import WholesalerPortalLinkCard from './WholesalerPortalLinkCard';

const NeedSource = () => <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Elige un mayorista a la izquierda para continuar.</p>;

export default function WholesalerAuditPanel() {
  const [connections, setConnections] = useState([]);
  const [source, setSource] = useState('todos');
  const [tab, setTab] = useState('buscar');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [billClient, setBillClient] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [invLoading, setInvLoading] = useState(false);

  const [loaded, setLoaded] = useState(false);
  useEffect(() => { base44.entities.WholesalerSync.list('created_date', 50).then((r) => setConnections(toRows(r))).finally(() => setLoaded(true)); }, []);
  const connection = connections.find((c) => (c.config_key || 'main') === source) || null;

  const loadInvoices = async () => {
    setInvLoading(true);
    const filter = source === 'todos' ? {} : { wholesaler_key: source };
    setInvoices(toRows(await base44.entities.WholesalerInvoice.filter(filter, '-emitted_date', 100)));
    setInvLoading(false);
  };
  useEffect(() => { if (tab === 'facturas') loadInvoices(); }, [tab, source]);

  const openClient = async (c) => {
    setDetailLoading(true);
    const logs = toRows(await base44.entities.WholesalerLog.filter({ client_email: c.email, tracking_number: { $exists: true, $ne: '' } }, '-event_date', 100));
    setSelected({ type: 'client', data: c, trackings: logs });
    setDetailLoading(false);
  };
  const openTracking = async (tracking) => {
    setDetailLoading(true);
    const res = await base44.functions.invoke('wholesalerShipments', { action: 'status', search: tracking, connection_id: connection?.id })
      .catch((e) => ({ data: { error: e?.response?.data?.error || 'No se pudo consultar el tracking.' } }));
    setSelected({ type: 'tracking', data: { tracking_number: tracking, ...(res?.data || {}) } });
    setDetailLoading(false);
  };
  const bill = (c) => {
    setSource(c.wholesaler_key || 'main');
    setBillClient(c);
    setTab('facturar');
  };

  if (!loaded) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!connections.length) return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No hay mayoristas conectados todavía.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
      <WholesalerSourceList connections={connections} value={source} onChange={(k) => { setSource(k); setSelected(null); setBillClient(null); }} />
      <div className="min-w-0 space-y-4 rounded-2xl border bg-card p-5 shadow-card">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="buscar">Buscador</TabsTrigger>
            <TabsTrigger value="facturar">Facturar</TabsTrigger>
            <TabsTrigger value="facturas">Facturas</TabsTrigger>
            <TabsTrigger value="portal">Portal</TabsTrigger>
          </TabsList>
          <TabsContent value="buscar" className="pt-4"><WholesalerUniversalSearch source={source} onSelectClient={openClient} onSelectTracking={openTracking} /></TabsContent>
          <TabsContent value="facturar" className="pt-4">
            {connection ? <WholesalerManualInvoiceForm connection={connection} preselect={billClient} onEmitted={() => { setBillClient(null); setTab('facturas'); }} /> : <NeedSource />}
          </TabsContent>
          <TabsContent value="facturas" className="pt-4">
            {invLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : <WholesalerInvoiceTable invoices={invoices} showWholesaler={source === 'todos'} />}
          </TabsContent>
          <TabsContent value="portal" className="pt-4">{connection ? <WholesalerPortalLinkCard wholesalerKey={source} /> : <NeedSource />}</TabsContent>
        </Tabs>
      </div>
      <WholesalerAuditDetail selected={selected} loading={detailLoading} onBill={bill} />
    </div>
  );
}