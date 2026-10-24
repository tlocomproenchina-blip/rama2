import React from 'react';
import SupportCollectionsPanel from '@/components/support/collections/SupportCollectionsPanel';

export default function AdminSupportCollections() {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Cobranza</h1>
        <p className="text-slate-500">Facturas pendientes, días vencidos y recordatorios de pago al cliente</p>
      </div>
      <SupportCollectionsPanel />
    </div>
  );
}