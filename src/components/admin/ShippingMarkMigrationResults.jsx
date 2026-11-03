import React from 'react';

const STATUS = {
  migrado: 'bg-emerald-100 text-emerald-700',
  pendiente: 'bg-amber-100 text-amber-700',
  error: 'bg-rose-100 text-rose-700',
};

export default function ShippingMarkMigrationResults({ records }) {
  if (!records.length) return <p className="text-sm text-muted-foreground">Todavía no hay clientes migrados.</p>;
  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
          <tr><th className="p-2">Cliente</th><th className="p-2">Anterior</th><th className="p-2">Nuevo</th><th className="p-2">Registros</th><th className="p-2">Estado</th></tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.old_mark + r.client_email} className="border-t border-border">
              <td className="p-2">{r.client_name || r.client_email}</td>
              <td className="p-2 font-mono">{r.old_mark}</td>
              <td className="p-2 font-mono font-semibold">{r.new_mark}</td>
              <td className="p-2">{Object.values(r.related_updates || {}).reduce((a, b) => a + b, 0)}</td>
              <td className="p-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[r.status] || ''}`}>{r.status}</span>
                {r.error && <p className="mt-1 text-xs text-destructive">{r.error}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}