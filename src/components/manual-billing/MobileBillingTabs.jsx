import React from 'react';
import { Package, UserRound, Boxes, ReceiptText } from 'lucide-react';

import { num } from '@/lib/numbers';

// Pestañas de Facturación Manual en móvil y tablet: cada sección se abre por
// separado y la barra queda fija arriba para saltar al resumen en cualquier momento.
export default function MobileBillingTabs({ active, onChange, pendingCount, receiptsCount, total, hasClient }) {
  const tabs = [
    { key: 'pendiente', label: 'Pendiente', icon: Package, badge: pendingCount },
    { key: 'cliente', label: 'Cliente', icon: UserRound },
    { key: 'recibos', label: 'Recibos', icon: Boxes, badge: hasClient ? receiptsCount : null, disabled: !hasClient },
    { key: 'resumen', label: hasClient ? `$${num(total).toFixed(2)}` : 'Resumen', icon: ReceiptText, disabled: !hasClient },
  ];

  return (
    <div className="sticky top-[5.75rem] z-20 -mx-4 bg-background/95 px-4 py-2 xl:hidden">
      <div role="tablist" aria-label="Secciones de la factura" className="!flex !flex-nowrap !gap-1 rounded-2xl border border-border bg-card p-1 shadow-card">
        {tabs.map(({ key, label, icon: Icon, badge, disabled }) => {
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onChange(key)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 ${
                selected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <span className="relative">
                <Icon className="h-4 w-4" />
                {badge > 0 && (
                  <span className={`absolute -right-3 -top-1.5 rounded-full px-1 text-[9px] leading-4 ${selected ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
                    {badge}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}