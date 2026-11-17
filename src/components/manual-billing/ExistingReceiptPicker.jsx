import React, { useEffect, useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import { loadClientReceipts } from '@/lib/receiptFromBultos';

// Lista seleccionable de recibos ya creados del cliente.
export default function ExistingReceiptPicker({ email, value, onChange }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let alive = true;
    setItems(null);
    loadClientReceipts(email).then((r) => alive && setItems(r)).catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [email]);

  if (!items) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!items.length) return <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">Este cliente no tiene recibos creados.</p>;

  return (
    <div className="max-h-64 space-y-1.5 overflow-y-auto">
      {items.map((r) => {
        const active = value === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${active ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-muted'}`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{r.invoice_number || 'Sin N° de contenedor'}</p>
              <p className="text-xs text-muted-foreground">
                {String(r.fecha || '').slice(0, 10)} · {r.cbm || 0} CBM · {(r.tracking_numbers || []).length} tracking(s){r.billed ? ' · Facturado' : ''}
              </p>
            </div>
            {active && <Check className="h-4 w-4 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}