import React, { useState } from 'react';
import moment from 'moment';

const fmtDate = (d) => (d ? moment(d).format('DD/MM/YY HH:mm') : '—');

// Trackings que explican las diferencias, agrupados por motivo.
export default function ReconciliationIssueList({ groups }) {
  const visible = groups.filter((g) => g.items.length > 0);
  const [active, setActive] = useState(visible[0]?.key);
  if (visible.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Sin diferencias que revisar en este período.</p>;
  }
  const current = visible.find((g) => g.key === active) || visible[0];

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap gap-2">
        {visible.map((g) => (
          <button
            key={g.key}
            onClick={() => setActive(g.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${current.key === g.key ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
          >
            {g.label} ({g.total})
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{current.hint}</p>
      <ul className="mt-2 max-h-72 divide-y divide-border/60 overflow-y-auto">
        {current.items.map((it) => (
          <li key={`${it.tracking}-${it.package_id || ''}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="font-mono text-foreground">{it.tracking}</span>
            <span className="text-xs text-muted-foreground">
              {it.status ? `${it.status} · ` : ''}{it.client_email || it.result_type || ''} · escaneo {fmtDate(it.scanned_at)}
            </span>
          </li>
        ))}
      </ul>
      {current.total > current.items.length && (
        <p className="mt-2 text-[11px] text-muted-foreground">Mostrando {current.items.length} de {current.total}.</p>
      )}
    </div>
  );
}