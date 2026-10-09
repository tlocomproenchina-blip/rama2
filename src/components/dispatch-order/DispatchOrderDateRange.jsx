import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { format, parseISO, startOfMonth, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

const dayKey = (date) => format(date, 'yyyy-MM-dd');
const toDate = (key) => (key ? parseISO(`${key}T12:00:00`) : undefined);

const PRESETS = [
  { label: 'Hoy', run: () => [new Date(), new Date()] },
  { label: 'Últimos 7 días', run: () => [subDays(new Date(), 6), new Date()] },
  { label: 'Este mes', run: () => [startOfMonth(new Date()), new Date()] },
];

function DayField({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <CalendarDays className="h-4 w-4 mr-2" />
            {value ? format(toDate(value), 'dd/MM/yyyy') : 'Elegir fecha'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <Calendar
            mode="single"
            locale={es}
            selected={toDate(value)}
            onSelect={(day) => {
              if (!day) return;
              onChange(dayKey(day));
              setOpen(false);
            }}
            disabled={{ after: new Date() }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function DispatchOrderDateRange({ from, to, onFromChange, onToChange, onGenerate, onRegenerate, canRegenerate, loading }) {
  return (
    <Card className="border-border/70 shadow-card">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <DayField label="Desde" value={from} onChange={onFromChange} />
          <DayField label="Hasta" value={to} onChange={onToChange} />
          <Button onClick={() => onGenerate(false)} disabled={loading} className="sm:mb-0">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generar orden
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => {
                const [start, end] = preset.run();
                onFromChange(dayKey(start));
                onToChange(dayKey(end));
              }}
            >
              {preset.label}
            </Button>
          ))}
          {canRegenerate && (
            <Button variant="outline" size="sm" disabled={loading} onClick={() => onRegenerate()} className="sm:ml-auto">
              <RefreshCw className="h-4 w-4 mr-2" /> Regenerar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}