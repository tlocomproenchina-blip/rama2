import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import WholesalerInvoiceTable from '@/components/wholesaler/audit/WholesalerInvoiceTable';
import PortalStatCards from '@/components/wholesaler/portal/PortalStatCards';
import PortalSimpleList from '@/components/wholesaler/portal/PortalSimpleList';
import { EVENT_LABELS, money } from '@/lib/wholesalerScope';

// Vista del portal de un mayorista (enlace privado o cuenta individual).
export default function WholesalerPortalView({ data, headerAction }) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const match = (...vals) => !term || vals.some((v) => String(v || '').toLowerCase().includes(term));
  const clients = useMemo(() => (data?.clients || []).filter((c) => match(c.full_name, c.email, c.shipping_mark, c.cedula)), [data, term]);
  const trackings = useMemo(() => (data?.trackings || []).filter((t) => match(t.tracking_number, t.client_email, t.shipping_mark)), [data, term]);
  const invoices = useMemo(() => (data?.invoices || []).filter((i) => match(i.invoice_number, ...(i.clients || []).map((c) => c.client_name))), [data, term]);

  const w = data.wholesaler;
  const brand = data.brand;
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {brand?.logo_url && <img src={brand.logo_url} alt={brand.display_name || w.name} className="h-14 w-14 rounded-xl border object-contain bg-card" />}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">{brand ? 'Portal de clientes' : 'IMPORTACIONES TLEC CARGO · Portal de mayoristas'}</p>
              <h1 className="font-display text-3xl font-bold">{brand?.display_name || w.name}</h1>
              <p className="text-sm text-muted-foreground">Tarifas vigentes: envío {money(w.rate_per_cbm)}/CBM · puerta a puerta {money(w.door_to_door_per_cbm)}/CBM · manejo {money(w.handling_fee)}/paquete</p>
            </div>
          </div>
          {headerAction}
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