import React from 'react';
import { Badge } from '@/components/ui/badge';
import InvoiceRateAuditRow from './InvoiceRateAuditRow';

// Bloque de la revisión de tarifas: un grupo de facturas (corregidas, sin novedad o
// pendientes de revisión) con su contador.
export default function InvoiceRateAuditGroup({ kind, title, description, items = [] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="space-y-2">
        {items.map((item) => (
          <InvoiceRateAuditRow key={item.invoice_number} kind={kind} item={item} />
        ))}
      </div>
    </section>
  );
}