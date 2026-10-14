import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { HelpCircle } from 'lucide-react';

// Preguntas frecuentes de la empresa: al tocar una, se pega en el cuadro del
// mensaje del cliente para que el asistente arme la respuesta guiada.
export default function AssistantQuickPrompts({ onPick }) {
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    let active = true;
    base44.entities.FAQ.filter({ is_active: true }, 'order', 24)
      .then((items) => { if (active) setQuestions(items || []); })
      .catch(() => { if (active) setQuestions([]); });
    return () => { active = false; };
  }, []);

  if (questions.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <HelpCircle className="h-3.5 w-3.5" /> Preguntas frecuentes
      </p>
      <div className="flex flex-wrap gap-1.5">
        {questions.slice(0, 6).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item.question)}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
          >
            {item.question}
          </button>
        ))}
      </div>
    </div>
  );
}