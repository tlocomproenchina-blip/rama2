import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function CampaignRecipientRow({ client, checked, onToggle, disabled }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3 transition-colors',
        checked ? 'border-primary/60 bg-primary/5' : 'border-border/70'
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(client.email)}
        disabled={disabled}
        aria-label={`Seleccionar a ${client.full_name || client.email}`}
      />
      <button
        type="button"
        onClick={() => onToggle(client.email)}
        disabled={disabled}
        className="min-w-0 flex-1 text-left"
      >
        <div className="truncate text-sm font-semibold text-foreground">
          {client.full_name || client.email}
        </div>
        <div className="truncate text-xs text-muted-foreground">{client.email}</div>
        {client.whatsapp ? (
          <div className="truncate text-xs text-muted-foreground">Tel: {client.whatsapp}</div>
        ) : null}
      </button>
      {client.shipping_mark ? (
        <Badge variant="secondary" className="shrink-0 font-mono text-[11px]">
          {client.shipping_mark}
        </Badge>
      ) : null}
    </div>
  );
}