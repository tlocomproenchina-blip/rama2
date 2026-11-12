import React from 'react';
import { Badge } from '@/components/ui/badge';
import { STATUS_META, VAT_STATUS_META } from '@/lib/fiscalStatus';

export default function FiscalStatusBadge({ status, vat = false }) {
  const meta = (vat ? VAT_STATUS_META : STATUS_META)[status];
  if (!meta) return null;
  return (
    <Badge variant="outline" className={`whitespace-nowrap font-semibold ${meta.cls}`}>
      {meta.label}
    </Badge>
  );
}