import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Package, FileText, Wallet } from 'lucide-react';

const ITEMS = [
  { key: 'clients', label: 'Clientes', Icon: Users },
  { key: 'prealerts', label: 'Pre-alertas', Icon: Package },
  { key: 'invoices', label: 'Facturas', Icon: FileText },
  { key: 'payments', label: 'Cobros', Icon: Wallet }
];

export default function IntegratedAppStats({ appId }) {
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
  }, [appId]);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ITEMS.map(({ key, label, Icon }) => {
        const value = stats?.[key];
        const shown = value ? `${value.count}${value.exceeded ? '+' : ''}` : '—';
        return (
          <div key={key} className="rounded-lg border bg-slate-50 p-2 text-center">
            <Icon className="mx-auto h-3.5 w-3.5 text-slate-400" />
            <p className="text-sm font-semibold text-slate-800">{shown}</p>
            <p className="text-[10px] text-slate-500">{label}</p>
          </div>
        );
      })}
    </div>
  );
}