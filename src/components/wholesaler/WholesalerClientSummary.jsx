import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import WholesalerClientSummaryCard from './WholesalerClientSummaryCard';

// Resumen por cliente del mayorista: un bloque por cliente con su carga y el
// estado del aviso de cada tracking.
export default function WholesalerClientSummary({ clients = [], loading, onResent }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  if (!clients.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No hay carga registrada a nombre de los clientes de este mayorista en el período.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {clients.map((client) => (
        <WholesalerClientSummaryCard key={client.client_key} client={client} onResent={onResent} />
      ))}
    </div>
  );
}