import React from 'react';

// Badge compacto que muestra cuántas veces se ha impreso la etiqueta.
// 1 = gris, 2 = amarillo, 3+ = rojo
export default function PrintCountBadge({ count }) {
  const n = Number(count || 0);
  if (n === 0) return null;

  const styles = {
    1: 'bg-slate-100 text-slate-600 border-slate-200',
    2: 'bg-amber-100 text-amber-700 border-amber-200',
    3: 'bg-red-100 text-red-700 border-red-200',
  };
  const cls = styles[Math.min(n, 3)] || styles[3];

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cls} whitespace-nowrap`}>
      Impresa {n}x
    </span>
  );
}