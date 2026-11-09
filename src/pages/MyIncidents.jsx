import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import ReviewCard from '@/components/client-portal/ReviewCard';
import QuickFilterTabs from '@/components/client-portal/QuickFilterTabs';

const isIssue = (r) => r.result === 'recibida_con_incidencia';
const TYPES = [
  { value: 'abierto', label: 'Caja abierta' },
  { value: 'faltante', label: 'Contenido faltante' },
  { value: 'danado', label: 'Paquete dañado' },
];

export default function MyIncidents({ user }) {
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-inventory-reviews', user?.email],
    enabled: !!user?.email,
    queryFn: async () => (await base44.functions.invoke('getMyInventoryReviews', {})).data?.reviews || [],
  });
  const reviews = data || [];
  const warnings = reviews.filter(isIssue).length;

  const matchStatus = (r) => status === 'all' || (status === 'aviso' ? isIssue(r) : !isIssue(r));
  const matchType = (r) => type === 'all' || r.incident_type === type;
  const filtered = reviews.filter((r) => matchStatus(r) && matchType(r));

  const byType = reviews.filter(matchStatus);
  const byStatus = reviews.filter(matchType);
  const statusOptions = [
    { value: 'all', label: 'Todas', count: byStatus.length },
    { value: 'positiva', label: 'Positivas', count: byStatus.filter((r) => !isIssue(r)).length },
    { value: 'aviso', label: 'Con aviso', count: byStatus.filter(isIssue).length },
  ];
  const typeOptions = [
    { value: 'all', label: 'Todas', count: byType.length },
    ...TYPES.map((t) => ({ ...t, count: byType.filter((r) => r.incident_type === t.value).length })),
  ];

  return (
    <div className="space-y-4 w-full">
      <ClientPageHero
        icon={ShieldCheck}
        eyebrow="Revisión en almacén"
        title="Mis incidencias"
        description="Consulta el resultado de la revisión de tus paquetes en almacén."
        badges={[`${reviews.length} revisiones`, `${warnings} avisos`]}
      />
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : isError ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-sm text-slate-600">No pudimos cargar tus revisiones.</p>
          <Button variant="outline" onClick={() => refetch()}>Reintentar</Button>
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-12">Aún no hay revisiones registradas para tus paquetes.</p>
      ) : (
        <>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-card">
            <QuickFilterTabs label="Estado" options={statusOptions} value={status} onChange={setStatus} />
            <QuickFilterTabs label="Tipo de incidencia" options={typeOptions} value={type} onChange={setType} />
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-slate-500">No hay revisiones que coincidan con estos filtros.</p>
              <Button variant="outline" onClick={() => { setStatus('all'); setType('all'); }}>Quitar filtros</Button>
            </div>
          ) : (
            <div className="grid gap-3">{filtered.map((r) => <ReviewCard key={r.id} review={r} />)}</div>
          )}
        </>
      )}
    </div>
  );
}