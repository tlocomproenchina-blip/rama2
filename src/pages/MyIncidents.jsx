import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import ReviewCard from '@/components/client-portal/ReviewCard';

export default function MyIncidents() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-inventory-reviews'],
    queryFn: async () => (await base44.functions.invoke('getMyInventoryReviews', {})).data?.reviews || [],
  });
  const reviews = data || [];
  const warnings = reviews.filter((r) => r.result === 'recibida_con_incidencia').length;

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
        <div className="grid gap-3">{reviews.map((r) => <ReviewCard key={r.id} review={r} />)}</div>
      )}
    </div>
  );
}