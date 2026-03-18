import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

const toneStyles = {
  amber: {
    card: 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-100/70',
    icon: 'bg-amber-100 text-amber-700',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  blue: {
    card: 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-100/70',
    icon: 'bg-blue-100 text-blue-700',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  indigo: {
    card: 'border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-100/70',
    icon: 'bg-indigo-100 text-indigo-700',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  purple: {
    card: 'border-purple-200 bg-gradient-to-br from-purple-50 via-white to-fuchsia-100/70',
    icon: 'bg-purple-100 text-purple-700',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  emerald: {
    card: 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-100/70',
    icon: 'bg-emerald-100 text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  slate: {
    card: 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/80',
    icon: 'bg-slate-100 text-slate-700',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
  },
};

export default function PaymentMethodCard({
  title,
  description,
  icon: Icon,
  tone = 'slate',
  enabled,
  onEnabledChange,
  open,
  onToggleOpen,
  identityLabel,
  identityValue,
  onIdentityChange,
  identityPlaceholder,
  instructionsValue,
  onInstructionsChange,
  instructionsPlaceholder,
  children,
}) {
  const styles = toneStyles[tone] || toneStyles.slate;

  return (
    <Card className={cn('overflow-hidden rounded-2xl border shadow-sm transition-all', styles.card)}>
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex flex-1 items-start gap-4 text-left"
        >
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shadow-sm', styles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
              <Badge variant="outline" className={enabled ? styles.badge : 'border-slate-200 bg-white text-slate-500'}>
                {enabled ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-600 sm:text-sm">{description}</p>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
          <button
            type="button"
            onClick={onToggleOpen}
            className="rounded-full p-2 text-slate-500 transition hover:bg-white/70 hover:text-slate-800"
          >
            <ChevronDown className={cn('h-5 w-5 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {open && (
        <CardContent className="border-t border-white/70 bg-white/70 p-4 sm:p-5">
          <div className="grid gap-4">
            {identityLabel && onIdentityChange && (
              <div className="space-y-2">
                <Label>{identityLabel}</Label>
                <Input
                  value={identityValue || ''}
                  onChange={(e) => onIdentityChange(e.target.value)}
                  placeholder={identityPlaceholder}
                  className="bg-white"
                />
              </div>
            )}

            {onInstructionsChange && (
              <div className="space-y-2">
                <Label>Instrucciones Adicionales</Label>
                <Textarea
                  value={instructionsValue || ''}
                  onChange={(e) => onInstructionsChange(e.target.value)}
                  placeholder={instructionsPlaceholder}
                  rows={3}
                  className="bg-white"
                />
              </div>
            )}

            {children}
          </div>
        </CardContent>
      )}
    </Card>
  );
}