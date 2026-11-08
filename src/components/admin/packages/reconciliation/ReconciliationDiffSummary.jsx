import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('es-VE');
const signed = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : '0');

// Explica la diferencia entre registros y escaneos: cada parte suma o resta y el
// resultado cuadra exactamente con la resta de los dos totales.
export default function ReconciliationDiffSummary({ data }) {
  const r = data.records.received_in_period;
  const u = data.scans.unique_trackings;
  const diff = r - u;
  const m = data.match;
  const parts = [
    { label: 'Recibidos sin escaneo de bodega', value: data.records.without_scan },
    { label: 'Registros duplicados del mismo tracking', value: m.duplicate_records },
    { label: 'Escaneos de paquetes recibidos antes del período', value: -m.received_before },
    { label: 'Escaneados sin recepción en el sistema', value: -m.scanned_not_received },
    { label: 'Escaneados sin registro de paquete', value: -m.scanned_without_record },
    { label: 'Códigos distintos del mismo paquete', value: -m.same_package_codes },
  ];
  const balanced = m.scanned_not_received === 0 && m.scanned_without_record === 0 && m.duplicate_records === 0;

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {balanced
          ? <CheckCircle2 className="h-5 w-5 text-success" />
          : <AlertTriangle className="h-5 w-5 text-warning" />}
        <p className="font-display text-sm font-semibold text-foreground">
          Diferencia: {fmt(r)} registros − {fmt(u)} escaneados = <span className="tabular-nums">{signed(diff)}</span>
        </p>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{p.label}</span>
            <span className={`shrink-0 font-semibold tabular-nums ${p.value === 0 ? 'text-muted-foreground' : 'text-foreground'}`}>{signed(p.value)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Los escaneos repetidos del mismo tracking ({fmt(data.scans.repeated_scans)}) no se cuentan dos veces
        {data.scans.untracked > 0 ? ` y ${fmt(data.scans.untracked)} capturas sin tracking quedan fuera` : ''}.
      </p>
    </div>
  );
}