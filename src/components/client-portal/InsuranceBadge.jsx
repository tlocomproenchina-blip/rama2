import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Clock, ShieldX, ShieldAlert } from 'lucide-react';

/**
 * Determina el estado del seguro de un paquete.
 * @param {object} pkg - El paquete
 * @param {object|null} insurancePayment - El pago de seguro más reciente (o null)
 * @returns {{state: string, label: string, deadline?: string}}
 *   state: 'asegurado' | 'pendiente' | 'pagar' | 'vencido' | 'none'
 */
export function getInsuranceState(pkg, insurancePayment) {
  if (!pkg) return { state: 'none' };
  if (pkg.has_insurance) return { state: 'asegurado' };
  if (pkg.insurance_expired) return { state: 'vencido' };
  if (insurancePayment && insurancePayment.status === 'pendiente') return { state: 'pendiente' };
  if (pkg.insurance_deadline) return { state: 'pagar', deadline: pkg.insurance_deadline };
  return { state: 'none' };
}

function useCountdown(deadlineIso) {
  const [remaining, setRemaining] = useState(() => calcRemaining(deadlineIso));

  function calcRemaining(dl) {
    if (!dl) return null;
    const diff = new Date(dl).getTime() - Date.now();
    return diff > 0 ? diff : 0;
  }

  useEffect(() => {
    if (!deadlineIso) return;
    setRemaining(calcRemaining(deadlineIso));
    const interval = setInterval(() => {
      const r = calcRemaining(deadlineIso);
      setRemaining(r);
      if (r === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineIso]);

  if (remaining == null) return null;
  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds, expired: remaining === 0 };
}

export default function InsuranceBadge({ pkg, insurancePayment, onClick, showButton = false }) {
  const { state, deadline } = getInsuranceState(pkg, insurancePayment);
  const countdown = useCountdown(deadline);

  if (state === 'none') {
    if (!showButton) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        className="text-emerald-700 border-emerald-200 text-xs"
      >
        <Shield className="h-3 w-3 mr-1" /> Asegurar
      </Button>
    );
  }

  if (state === 'asegurado') {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
      >
        <Shield className="h-3 w-3 mr-1" />
        Asegurado
      </Badge>
    );
  }

  if (state === 'pendiente') {
    return (
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
      >
        <ShieldAlert className="h-3 w-3 mr-1" />
        Seguro pendiente
      </Badge>
    );
  }

  if (state === 'vencido') {
    return (
      <Badge
        variant="outline"
        className="bg-slate-100 text-slate-500 border-slate-200 text-xs"
      >
        <ShieldX className="h-3 w-3 mr-1" />
        Sin seguro
      </Badge>
    );
  }

  if (state === 'pagar') {
    const label = countdown
      ? `Pagar seguro ${String(countdown.hours).padStart(2, '0')}:${String(countdown.minutes).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`
      : 'Pagar seguro';
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        className="text-red-700 border-red-200 bg-red-50 text-xs animate-pulse"
      >
        <Clock className="h-3 w-3 mr-1" />
        {label}
      </Button>
    );
  }

  return null;
}