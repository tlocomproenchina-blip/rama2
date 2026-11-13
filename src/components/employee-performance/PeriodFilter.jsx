import React from 'react';
import { Input } from '@/components/ui/input';
import { PERIOD_PRESETS } from '@/lib/periodRange';

export default function PeriodFilter({ preset, onPresetChange, custom, onCustomChange }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PERIOD_PRESETS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onPresetChange(item.value)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              preset === item.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-accent'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {preset === 'rango' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={custom.from} max={custom.to} onChange={(e) => onCustomChange({ ...custom, from: e.target.value })} className="w-[170px]" />
          <span className="text-sm text-muted-foreground">al</span>
          <Input type="date" value={custom.to} min={custom.from} onChange={(e) => onCustomChange({ ...custom, to: e.target.value })} className="w-[170px]" />
        </div>
      )}
    </div>
  );
}