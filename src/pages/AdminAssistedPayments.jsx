import React from 'react';
import AssistedPaymentsList from '@/components/admin/AssistedPaymentsList.jsx';

export default function AdminAssistedPayments() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-800 mb-4">Pagos Asistidos</h1>
      <AssistedPaymentsList />
    </div>
  );
}