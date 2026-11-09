import React from 'react';
import { UserCheck } from 'lucide-react';

// "Registrado en almacén por": emails de quienes recibieron los paquetes de la unidad.
// Si varios empleados recibieron paquetes distintos, se listan todos con su cantidad.
export default function ReceivedByLine({ packageIds, receivedByMap }) {
  const ids = (packageIds || []).filter((id) => id && !String(id).startsWith('local_'));
  if (!ids.length || !receivedByMap) return null;
  if (!ids.some((id) => id in receivedByMap)) return null;

  const counts = new Map();
  ids.forEach((id) => {
    const who = receivedByMap[id] || 'No disponible';
    counts.set(who, (counts.get(who) || 0) + 1);
  });
  const multiple = counts.size > 1;

  return (
    <div className="mt-0.5 flex items-start gap-1 text-xs text-slate-500">
      <UserCheck className="mt-0.5 h-3 w-3 shrink-0" />
      <span className="min-w-0 break-all">
        Registrado en almacén por:{' '}
        {[...counts.entries()].map(([who, n], i) => (
          <span key={who}>
            {i > 0 && ', '}
            <span className={who === 'No disponible' ? 'italic text-slate-400' : 'font-medium text-slate-700'}>{who}</span>
            {multiple && <span className="text-slate-400"> ({n} paq.)</span>}
          </span>
        ))}
      </span>
    </div>
  );
}