import React from 'react';
import { Package, PackageCheck, PackageSearch, ListFilter } from 'lucide-react';

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-foreground">
        {Number.isFinite(Number(value)) ? Number(value).toLocaleString('es-VE') : '—'}
      </p>
    </div>
  );
}

export default function PortalStats({ stats }) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard icon={Package} label="Total de trackings" value={stats?.total} />
      <StatCard icon={PackageSearch} label="Por recibir" value={stats?.por_recibir} />
      <StatCard icon={PackageCheck} label="Recibidos" value={stats?.recibidos} />
      <StatCard icon={ListFilter} label="Resultados filtrados" value={stats?.resultados} />
    </section>
  );
}