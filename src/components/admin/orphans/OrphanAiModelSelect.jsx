import React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { ORPHAN_AI_MODELS, getOrphanAiModel, modelTags } from '@/lib/orphanAiModels';
import AiModelDots from '@/components/admin/orphans/AiModelDots';

// IA con la que se leen las fotos de las cargas huérfanas. El reclamo usa exactamente
// la que esté elegida aquí y la elección se conserva para los próximos usos. Cada
// opción muestra sus puntos de calidad, créditos y velocidad para poder comparar.
export default function OrphanAiModelSelect({ value, onChange, disabled }) {
  const selected = getOrphanAiModel(value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-[230px] items-center gap-2 rounded-md border border-purple-200 bg-purple-50/60 px-3 text-sm font-medium text-purple-800 transition hover:bg-purple-100 disabled:opacity-60 sm:w-[300px] lg:w-[340px]"
          title={`IA para leer las fotos de las cargas huérfanas: ${selected.label}`}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{selected.label}</span>
          <AiModelDots model={selected} className="ml-auto shrink-0" />
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[420px] p-0">
        <div className="border-b bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold text-slate-700">IA para leer las fotos</p>
          <p className="text-[11px] text-slate-500">
            Verde = mejor en ese aspecto · rojo = más consumo
          </p>
        </div>

        <div className="max-h-[65vh] overflow-y-auto py-1">
          {ORPHAN_AI_MODELS.map((model) => {
            const active = model.key === selected.key;
            return (
              <DropdownMenuItem
                key={model.key}
                onSelect={() => onChange(model.key)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${active ? 'bg-blue-50' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-slate-800">{model.label}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                  </div>
                  {modelTags(model).length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {modelTags(model).map((tag) => (
                        <Badge
                          key={tag.text}
                          variant="outline"
                          className={`px-1.5 py-0 text-[10px] font-medium ${tag.className}`}
                        >
                          {tag.text}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <AiModelDots model={model} showLabels className="shrink-0" />
              </DropdownMenuItem>
            );
          })}
        </div>

        <div className="border-t bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          Calidad: qué tan bien lee las etiquetas · Créditos: consumo de integración · Velocidad:
          qué tan rápido responde.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}