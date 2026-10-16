import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles } from 'lucide-react';

// IA con la que se leen las fotos de las cargas huérfanas. El reclamo usa exactamente
// la que esté elegida aquí: Claude Sonnet consume créditos de integración y OpenAI
// directo no. La elección se conserva para los próximos usos.
const HINTS = {
  claude: 'Claude Sonnet · usa créditos de integración',
  openai: 'OpenAI · sin créditos de integración',
};

export default function OrphanAiModelSelect({ value, onChange, disabled }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className="h-9 w-[260px] border-purple-200 bg-purple-50/60 text-purple-800"
        title={HINTS[value] || HINTS.claude}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="claude">{HINTS.claude}</SelectItem>
        <SelectItem value="openai">{HINTS.openai}</SelectItem>
      </SelectContent>
    </Select>
  );
}