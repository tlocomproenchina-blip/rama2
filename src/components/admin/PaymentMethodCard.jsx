import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ChevronDown, Pencil } from 'lucide-react';

const toneStyles = {
  amber: {
    icon: 'bg-amber-100 text-amber-700',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    action: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
  },
  blue: {
    icon: 'bg-blue-100 text-blue-700',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    action: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  },
  indigo: {
    icon: 'bg-indigo-100 text-indigo-700',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    action: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
  },
  purple: {
    icon: 'bg-purple-100 text-purple-700',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    action: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
  },
  emerald: {
    icon: 'bg-emerald-100 text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    action: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-700',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    action: 'bg-slate-50 text-slate-700 hover:bg-slate-100',
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
  const previewLines = [identityValue, instructionsValue].filter(Boolean);

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onToggleOpen}
            className="flex min-w-0 flex-1 items-start gap-3 text-left"
          >
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', styles.icon)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
                <Badge variant="outline" className={enabled ? styles.badge : 'border-slate-200 bg-slate-50 text-slate-500'}>
                  {enabled ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">{description}</p>
            </div>
          </button>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Datos de la cuenta</p>
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            {previewLines.length > 0 ? previewLines.slice(0, 2).map((line, index) => (
              <p key={index} className="break-words">{line}</p>
            )) : (
              <p className="text-slate-400">Sin datos configurados</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onToggleOpen} className={cn('flex-1 border-0', styles.action)}>
            <Pencil className="mr-2 h-4 w-4" />
            {open ? 'Ocultar' : 'Editar'}
          </Button>
          <button
            type="button"
            onClick={onToggleOpen}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            <ChevronDown className={cn('h-5 w-5 transition-transform', open && 'rotate-180')} />
          </button>
        </div>

        {open && (
          <div className="mt-4 border-t border-slate-100 pt-4">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}