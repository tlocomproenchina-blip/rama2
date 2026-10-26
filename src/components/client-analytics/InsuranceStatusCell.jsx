import React from 'react';
import { Badge } from '@/components/ui/badge';

const STYLES = {
  pagado: { label: 'Pagado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  no_pagado: { label: 'No pagado', className: 'bg-red-50 text-red-700 border-red-200' },
  rechazado: { label: 'Rechazado', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  pendiente: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  sin_seguro: { label: 'Sin seguro', className: 'bg-slate-500 text-white border-slate-500' },
};

export function getInsuranceState(pkg, payment) {
  if (!pkg) return 'sin_seguro';
  if (pkg.has_insurance || payment?.status === 'aprobado') return 'pagado';
  if (payment?.status === 'pendiente') return 'pendiente';
  if (payment?.status === 'rechazado') return 'rechazado';
  if (pkg.insurance_expired) return 'rechazado';
  if (pkg.insurance_deadline) return 'pendiente';
  if (Number(pkg.fob_value || 0) > 0) return 'no_pagado';
  return 'sin_seguro';
}

export default function InsuranceStatusCell({ pkg, payment }) {
  const state = getInsuranceState(pkg, payment);
  const style = STYLES[state];
  const fob = Number(pkg?.fob_value || 0);

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant="outline" className={`${style.className} text-xs whitespace-nowrap`}>{style.label}</Badge>
      {fob > 0 && (
        <span className="text-[11px] text-slate-500 whitespace-nowrap">FOB ${fob.toFixed(2)}</span>
      )}
    </div>
  );
}