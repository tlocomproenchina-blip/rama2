import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Package, FileText, Wallet, AlertCircle } from 'lucide-react';

const ITEMS = [
  { key: 'clients', label: 'Clientes', Icon: Users },
  { key: 'prealerts', label: 'Pre-alertas', Icon: Package },
  { key: 'invoices', label: 'Facturas', Icon: FileText },
  { key: 'payments', label: 'Cobros', Icon: Wallet },
  { key: 'pending', label: 'Pendientes', Icon: AlertCircle, alert: true }
];

export default function IntegratedAppStats({ appId, refreshKey = 0 }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    base44.functions
      .invoke('manageIntegratedApps', { action: 'stats', app_id: appId })
      .then(({ data }) => {
        if (active) setStats(data?.stats || null);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [appId, refreshKey]);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {ITEMS.map(({ key, label, Icon, alert }) => {
        const value = stats?.[key];
        const shown = value ? `${value.count}${value.exceeded ? '+' : ''}` : '—';
        const hot = alert && Number(value?.count) > 0;
        return (
          <div
            key={key}
            className={`rounded-lg border p-2 text-center ${hot ? 'border-amber-300 bg-amber-50' : 'bg-slate-50'}`}
          >
            <Icon className={`mx-auto h-3.5 w-3.5 ${hot ? 'text-amber-500' : 'text-slate-400'}`} />
            <p className={`text-sm font-semibold ${hot ? 'text-amber-700' : 'text-slate-800'}`}>{shown}</p>
            <p className="text-[10px] text-slate-500">{label}</p>
          </div>
        );
      })}
    </div>
  );
}