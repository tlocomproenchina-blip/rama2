import React from 'react';
import { ORPHAN_AI_DOT_COLORS, ORPHAN_AI_METRICS } from '@/lib/orphanAiModels';

// Puntos de color con los que se compara cada IA: calidad de lectura, consumo de
// créditos de integración y velocidad. Verde = mejor en ese aspecto, rojo = peor
// (en créditos, rojo es el que más consume y verde el que no consume).
export default function AiModelDots({ model, showLabels = false, className = '' }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      {ORPHAN_AI_METRICS.map((metric) => {
        const value = model?.[metric.key] || 0;
        const color = ORPHAN_AI_DOT_COLORS[metric.key]?.[value] || 'bg-slate-300';
        return (
          <span
            key={metric.key}
            className="flex flex-col items-center gap-0.5"
            title={`${metric.label}: ${value} de 3`}
          >
            <span className="flex items-center gap-[3px]">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i <= value ? color : 'bg-slate-200'}`}
                />
              ))}
            </span>
            {showLabels && (
              <span className="text-[9px] font-medium leading-none text-slate-400">
                {metric.short}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}