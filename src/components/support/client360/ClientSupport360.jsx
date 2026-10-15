import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import Client360Packages from './Client360Packages';
import Client360Bultos from './Client360Bultos';
import Client360Invoices from './Client360Invoices';
import Client360Recibos from './Client360Recibos';
import Client360Tickets from './Client360Tickets';
import Client360DispatchOrders from './Client360DispatchOrders';

export default function ClientSupport360({ clientEmail, currentTicketId, hideTickets = false }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ packages: [], bultos: [], invoices: [], recibos: [], tickets: [], dispatchOrders: [] });
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!clientEmail) return;
    let active = true;
    setLoading(true);
    Promise.allSettled([
    base44.entities.Package.filter({ client_email: clientEmail }, '-created_date', 200),
    base44.entities.Bulto.filter({ client_email: clientEmail }, '-created_date', 100),
    base44.entities.Invoice.filter({ client_email: clientEmail }, '-created_date', 100),
    base44.entities.CbmIngreso.filter({ client_email: clientEmail }, '-created_date', 100),
    base44.entities.SupportTicket.filter({ client_email: clientEmail }, '-created_date', 30),
    base44.entities.DispatchOrder.filter({ client_email: clientEmail }, '-dispatched_date', 50)]
    ).then(([p, b, i, r, t, d]) => {
      if (!active) return;
      setData({
        packages: p.status === 'fulfilled' ? p.value : [],
        bultos: b.status === 'fulfilled' ? b.value : [],
        invoices: i.status === 'fulfilled' ? i.value : [],
        recibos: r.status === 'fulfilled' ? r.value : [],
        tickets: (t.status === 'fulfilled' ? t.value : []).filter((tk) => tk.id !== currentTicketId),
        dispatchOrders: d.status === 'fulfilled' ? d.value : []
      });
      setLoading(false);
    });
    return () => {active = false;};
  }, [clientEmail, currentTicketId]);

  const filtered = useMemo(() => {
    const raw = q.trim().toLowerCase();
    if (!raw) return data;
    const terms = [raw, raw.replace(/\s+/g, '_')];
    const match = (...vals) => vals.some((v) => {
      const str = String(v ?? '').toLowerCase();
      return terms.some((t) => str.includes(t));
    });
    return {
      packages: data.packages.filter((p) => match(p.tracking_number, p.description, p.status, p.shipping_mark)),
      bultos: (data.bultos || []).filter((b) => match(b.label_code, b.status, b.shipping_mark, (b.package_trackings || []).join(' '), (b.cbm_order_numbers || []).join(' '))),
      invoices: data.invoices.filter((i) => match(i.invoice_number, i.status, i.notes, i.total)),
      recibos: data.recibos.filter((r) => match(r.invoice_number, r.descripcion, r.proveedor, (r.tracking_numbers || []).join(' '))),
      tickets: data.tickets.filter((t) => match(t.ticket_number, t.subject, t.status, t.related_tracking)),
      dispatchOrders: (data.dispatchOrders || []).filter((o) => match(o.order_number, o.status, o.shipping_mark, o.client_name))
    };
  }, [data, q]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>);

  }

  return (
    <div className="space-y-4 w-full max-w-full min-w-0 overflow-hidden">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en todo: tracking, pre alerta, bulto, factura, recibo, estado..." className="min-h-[48px]" />
        
      </div>
      <Client360Packages packages={filtered.packages} />
      <Client360Bultos bultos={filtered.bultos} />
      <Client360Recibos recibos={filtered.recibos} />
      <Client360Invoices invoices={filtered.invoices} recibos={data.recibos} />
      <Client360DispatchOrders orders={filtered.dispatchOrders} />
      {hideTickets ? null : <Client360Tickets tickets={filtered.tickets} />}
    </div>);
}