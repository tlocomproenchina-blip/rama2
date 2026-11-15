import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import PasswordGate from '@/components/common/PasswordGate';
import WholesalerInvoiceTable from '@/components/wholesaler/audit/WholesalerInvoiceTable';
import PortalStatCards from '@/components/wholesaler/portal/PortalStatCards';
import PortalSimpleList from '@/components/wholesaler/portal/PortalSimpleList';
import { EVENT_LABELS, money } from '@/lib/wholesalerScope';

// Portal privado de un mayorista: solo sus clientes, trackings y facturas.
export default function WholesalerPortal() {
  const { token } = useParams();
  const storageKey = `wholesaler-portal-pw:${token}`;
  const [data, setData] = useState(null);
  const [gate, setGate] = useState(null);
  const [invalid, setInvalid] = useState(false);
  const [q, setQ] = useState('');

  const load = (password) => base44.functions.invoke('wholesalerPortal', { action: 'access', token, password })
    .then((res) => { sessionStorage.setItem(storageKey, password); setGate(null); setData(res.data); })
    .catch((err) => {
      const d = err?.response?.data;
      if (d?.password_required) { sessionStorage.removeItem(storageKey); setGate({ error: password ? d.error : '', loading: false }); }
      else setInvalid(true);
    });

  useEffect(() => { load(sessionStorage.getItem(storageKey) || ''); }, [token]);

  const term = q.trim().toLowerCase();
  const match = (...vals) => !term || vals.some((v) => String(v || '').toLowerCase().includes(term));
  const clients = useMemo(() => (data?.clients || []).filter((c) => match(c.full_name, c.email, c.shipping_mark, c.cedula)), [data, term]);
  const trackings = useMemo(() => (data?.trackings || []).filter((t) => match(t.tracking_number, t.client_email, t.shipping_mark)), [data, term]);
  const invoices = useMemo(() => (data?.invoices || []).filter((i) => match(i.invoice_number, ...(i.clients || []).map((c) => c.client_name))), [data, term]);

  if (invalid) return <p className="py-20 text-center text-muted-foreground">Este enlace no es válido o fue reemplazado.</p>;
  if (gate) return <PasswordGate title="Portal de mayoristas" error={gate.error} loading={gate.loading} onSubmit={(pw) => { setGate({ error: '', loading: true }); load(pw); }} />;
  if (!data) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const w = data.wholesaler;
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">IMPORTACIONES TLEC CARGO · Portal de mayoristas</p>
          <h1 className="font-display text-3xl font-bold">{w.name}</h1>
          <p className="text-sm text-muted-foreground">Tarifas vigentes: envío {money(w.rate_per_cbm)}/CBM · puerta a puerta {money(w.door_to_door_per_cbm)}/CBM · manejo {money(w.handling_fee)}/paquete</p>
        </div>
        <PortalStatCards data={data} />
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="h-11" placeholder="Buscar cliente, Shipping Mark, tracking o factura…" /></div>
        <Tabs defaultValue="facturas">
          <TabsList><TabsTrigger value="facturas">Facturas ({invoices.length})</TabsTrigger><TabsTrigger value="clientes">Clientes ({clients.length})</TabsTrigger><TabsTrigger value="trackings">Trackings ({trackings.length})</TabsTrigger></TabsList>
          <TabsContent value="facturas" className="pt-4"><WholesalerInvoiceTable invoices={invoices} /></TabsContent>
          <TabsContent value="clientes" className="pt-4">
            <PortalSimpleList rows={clients} empty="Sin clientes." render={(c) => [c.full_name || c.email, `${c.shipping_mark || 'sin mark'} · ${c.email}${c.city ? ` · ${c.city}` : ''}`]} />
          </TabsContent>
          <TabsContent value="trackings" className="pt-4">
            <PortalSimpleList rows={trackings} empty="Sin trackings." render={(t) => [t.tracking_number, `${t.client_email || t.shipping_mark || 'sin cliente'} · ${EVENT_LABELS[t.event_type] || t.event_type}${t.event_date ? ` · ${new Date(t.event_date).toLocaleDateString('es-VE')}` : ''}`]} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}