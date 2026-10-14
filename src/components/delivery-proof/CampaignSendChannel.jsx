import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Send, Zap, Coins } from 'lucide-react';

const OPTIONS = [
  {
    value: 'brevo',
    label: 'Brevo',
    icon: Zap,
    description: 'Usa la cuota diaria de Brevo. No consume créditos de integración.'
  },
  {
    value: 'base44',
    label: 'Base44',
    icon: Coins,
    description: 'Usa los créditos de integración del plan. Útil cuando la cuota de Brevo está agotada.'
  }
];

export default function CampaignSendChannel({ provider, onChange, disabled }) {
  const current = OPTIONS.find((option) => option.value === provider) || OPTIONS[0];

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Send className="h-4 w-4 text-primary" /> Canal de envío
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = option.value === provider;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                disabled={disabled}
                aria-pressed={active}
                className={cn(
                  'flex items-center gap-2 rounded-2xl border p-3 text-left text-sm font-semibold transition',
                  active ? 'border-primary bg-primary/10 text-foreground' : 'border-border/70 bg-card text-muted-foreground hover:border-primary/50',
                  disabled ? 'cursor-not-allowed opacity-60' : ''
                )}
              >
                <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{current.description}</p>
      </CardContent>
    </Card>
  );
}