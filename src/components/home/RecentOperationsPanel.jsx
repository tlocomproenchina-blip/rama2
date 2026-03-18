import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import RecentActivity from '@/components/dashboard/RecentActivity';

function pickLatest(items, limit = 4) {
  return (items || [])
    .filter(Boolean)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, limit);
}

export default function RecentOperationsPanel({ user }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    const loadRecentActivity = async () => {
      if (user?.role !== 'admin') {
        if (active) {
          setItems([]);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const [packages, requests, consolidations, admins] = await Promise.all([
          base44.entities.Package.list('-updated_date', 8),
          base44.entities.ConsolidationRequest.list('-updated_date', 8),
          base44.entities.Consolidation.list('-updated_date', 8),
          base44.entities.User.filter({ role: 'admin' }, '-updated_date', 8),
        ]);

        const packageItems = (packages || []).map((pkg) => ({
          type: 'package',
          title: `Paquete ${pkg.tracking_number || ''} · ${pkg.status || 'actualizado'}`,
          description: pkg.client_email || pkg.shipping_mark || 'Movimiento en paquetes',
          date: pkg.updated_date || pkg.received_date || pkg.created_date,
        }));

        const requestItems = (requests || []).map((request) => ({
          type: 'consolidation',
          title: `Solicitud de consolidación · ${request.status || 'actualizada'}`,
          description: request.client_email || request.shipping_mark || 'Solicitud actualizada',
          date: request.approved_date || request.updated_date || request.created_date,
        }));

        const consolidationItems = (consolidations || []).map((item) => ({
          type: 'consolidation',
          title: `Consolidación ${item.consolidation_tracking || ''} · ${item.status || 'actualizada'}`,
          description: item.client_email || 'Cambio en consolidación',
          date: item.payment_validation_date || item.shipping_date || item.updated_date || item.created_date,
        }));

        const adminItems = (admins || []).map((admin) => ({
          type: 'user',
          title: `${admin.full_name || admin.email} · ${admin.custom_role || 'sin área'}`,
          description: 'Administrador o empleado actualizado',
          date: admin.updated_date || admin.created_date,
        }));

        const merged = pickLatest([
          ...packageItems,
          ...requestItems,
          ...consolidationItems,
          ...adminItems,
        ], 10);

        if (active) setItems(merged);
      } catch (error) {
        console.error('Error loading recent operations:', error);
        if (active) setItems([]);
      }

      if (active) setLoading(false);
    };

    loadRecentActivity();
    return () => { active = false; };
  }, [user?.role]);

  if (user?.role !== 'admin') return null;

  return (
    <section className="max-w-7xl mx-auto px-6 py-6 md:py-8">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-900">Actividad reciente</h2>
        <p className="text-sm text-slate-500">Últimas acciones administrativas y cambios recientes en solicitudes y estados.</p>
      </div>
      <RecentActivity items={loading ? [] : items} />
    </section>
  );
}