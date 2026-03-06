import React from 'react';
import AssistedPaymentForm from '@/components/assisted/AssistedPaymentForm.jsx';
import AssistedPaymentHistory from '@/components/assisted/AssistedPaymentHistory.jsx';

export default function AssistedPayment({ user }) {
  return (
    <div className="max-w-3xl mx-auto">
      <AssistedPaymentForm user={user} />
      <AssistedPaymentHistory user={user} />
    </div>
  );
}