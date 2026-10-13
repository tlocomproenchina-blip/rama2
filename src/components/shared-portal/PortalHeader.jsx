import React from 'react';
import { ShieldCheck } from 'lucide-react';

const LOGO_URL = 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/362c2e6ac_WhatsAppImage2026-08-17at90120AM.jpeg';

export default function PortalHeader({ link }) {
  const names = (link?.scope_wholesaler_names || []).filter(Boolean);
  const parts = [];
  if (names.length) parts.push(`Mayoristas: ${names.join(', ')}`);
  if (link?.scope_clients) parts.push(`${link.scope_clients} cliente(s)`);
  if (link?.scope_marks) parts.push(`${link.scope_marks} Shipping Mark(s)`);
  const scopeText = link?.scope_mode === 'limitado'
    ? (parts.join(' · ') || 'Alcance sin definir')
    : 'Todos los mayoristas y registros directos';

  return (
    <header className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="TLEC CARGO" className="h-11 w-11 rounded-xl object-contain" />
          <div>
            <p className="font-display text-lg font-bold tracking-tight text-foreground">TLEC CARGO</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Portal de consulta de tracking
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Solo lectura
          </span>
          {link?.label ? (
            <span className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {link.label}
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{scopeText}</p>
    </header>
  );
}