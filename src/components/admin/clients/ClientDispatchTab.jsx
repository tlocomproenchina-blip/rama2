import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Truck, FileText, Boxes } from 'lucide-react';
import DispatchOrderMiniCard from './DispatchOrderMiniCard';
import DispatchGuideMiniCard from './DispatchGuideMiniCard';
import ClientBultoRow from './ClientBultoRow';

function Section({ icon: Icon, label, count, children }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-slate-500" />
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <span className="text-xs text-slate-500">({count})</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }) {
  return <p className="text-sm text-slate-400 bg-slate-50 rounded-lg px-4 py-3">{text}</p>;
}

export default function ClientDispatchTab({ client }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [guides, setGuides] = useState([]);
  const [bultos, setBultos] = useState([]);
  const [packagesById, setPackagesById] = useState({});

  useEffect(() => {
    if (client?.email) loadDispatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.email, client?.shipping_mark]);

  const loadDispatch = async () => {
    setLoading(true);
    const email = client.email;
    const mark = (client.shipping_mark || '').trim();

    const ordersQuery = mark ? { $or: [{ client_email: email }, { shipping_mark: mark }] } : { client_email: email };
    const guidesQuery = mark ? { $or: [{ client_emails: email }, { shipping_marks: mark }] } : { client_emails: email };

    const [orderPage, guidePage, bultoPage] = await Promise.all([
      base44.entities.DispatchOrder.filter(ordersQuery, { sort: '-dispatched_date', limit: 100 }),
      base44.entities.DispatchGuide.filter(guidesQuery, { sort: '-emitted_date', limit: 100 }),
      base44.entities.Bulto.filter(ordersQuery, { sort: '-created_date', limit: 200 }),
    ]);

    setOrders(orderPage.items || []);
    setGuides(guidePage.items || []);
    const bultoList = bultoPage.items || [];
    setBultos(bultoList);

    const ids = [...new Set(bultoList.flatMap((b) => b.package_ids || []))].slice(0, 300);
    if (ids.length) {
      const pkgPage = await base44.entities.Package.filter(
        { id: { $in: ids } },
        { limit: 300, fields: ['tracking_number', 'description', 'status', 'shipping_type'] }
      );
      const map = {};
      (pkgPage.items || []).forEach((p) => { map[p.id] = p; });
      setPackagesById(map);
    } else {
      setPackagesById({});
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Section icon={Truck} label="Órdenes de despacho" count={orders.length}>
        {orders.length === 0 ? (
          <Empty text="Este cliente no tiene órdenes de despacho." />
        ) : (
          <div className="space-y-2">
            {orders.map((order) => <DispatchOrderMiniCard key={order.id} order={order} />)}
          </div>
        )}
      </Section>

      <Section icon={FileText} label="Guías de despacho" count={guides.length}>
        {guides.length === 0 ? (
          <Empty text="Este cliente no tiene guías de despacho." />
        ) : (
          <div className="space-y-2">
            {guides.map((guide) => <DispatchGuideMiniCard key={guide.id} guide={guide} />)}
          </div>
        )}
      </Section>

      <Section icon={Boxes} label="Bultos y cajas" count={bultos.length}>
        {bultos.length === 0 ? (
          <Empty text="Este cliente no tiene bultos registrados." />
        ) : (
          <div className="space-y-2">
            {bultos.map((bulto) => (
              <ClientBultoRow
                key={bulto.id}
                bulto={bulto}
                packages={(bulto.package_ids || []).map((id) => packagesById[id]).filter(Boolean)}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}