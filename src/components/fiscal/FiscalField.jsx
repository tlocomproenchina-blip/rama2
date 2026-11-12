import React from 'react';
import { Label } from '@/components/ui/label';

export default function FiscalField({ label, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      {label ? <Label className="text-sm font-medium text-foreground">{label}</Label> : null}
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}