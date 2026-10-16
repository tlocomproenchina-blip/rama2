import React from 'react';
import { Activity, AlertTriangle, ClipboardList, HelpCircle, Info, ListChecks, MessagesSquare, Package } from 'lucide-react';
import { parseCaseSummary, parseWhatsAppLines, parseGuideLines } from '@/lib/caseSummary';

const SECTION_STYLE = {
  question: { icon: HelpCircle, tone: 'border-sky-200/70 bg-sky-50/70', accent: 'text-sky-700' },
  diagnosis: { icon: Activity, tone: 'border-violet-200/70 bg-violet-50/70', accent: 'text-violet-700' },
  step: { icon: ListChecks, tone: 'border-amber-200/70 bg-amber-50/70', accent: 'text-amber-700' },
  reason: { icon: AlertTriangle, tone: 'border-orange-200/70 bg-orange-50/70', accent: 'text-orange-700' },
  summary: { icon: ClipboardList, tone: 'border-border/70 bg-muted/40', accent: 'text-muted-foreground' },
  transcript: { icon: MessagesSquare, tone: 'border-border/70 bg-muted/40', accent: 'text-muted-foreground' },
  history: { icon: Package, tone: 'border-border/70 bg-muted/40', accent: 'text-muted-foreground' },
};

const FALLBACK_STYLE = { icon: Info, tone: 'border-border/70 bg-muted/40', accent: 'text-muted-foreground' };

function Paragraphs({ text }) {
  const parts = String(text).split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return <p className="whitespace-pre-wrap break-words">{text}</p>;
  return (
    <div className="space-y-2">
      {parts.map((part, index) => (
        <p key={index} className="whitespace-pre-wrap break-words">{part}</p>
      ))}
    </div>
  );
}

function ConversationLines({ entries }) {
  return (
    <ul className="space-y-2.5">
      {entries.map((entry, index) => (
        <li key={index} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground sm:w-24 sm:pt-0.5">{entry.time}</span>
          <div className="min-w-0">
            <span className="text-[11px] font-medium text-muted-foreground">{entry.sender}</span>
            <p className="whitespace-pre-wrap break-words">{entry.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function GuideLines({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
          <p className="min-w-0 whitespace-pre-wrap break-words">
            {item.label ? <span className="font-medium">{item.label}: </span> : null}
            {item.text}
          </p>
        </li>
      ))}
    </ul>
  );
}

function SectionBody({ block }) {
  if (block.key === 'question') {
    const entries = parseWhatsAppLines(block.body);
    if (entries.length) return <ConversationLines entries={entries} />;
  }
  if (block.key === 'transcript') {
    const items = parseGuideLines(block.body);
    if (items.length) return <GuideLines items={items} />;
  }
  return <Paragraphs text={block.body} />;
}

// Muestra el resumen que dejó el ATC separado por partes; si el texto no trae
// esas partes reconocibles, se muestra tal cual.
export default function SupportCaseSummary({ text, className = '' }) {
  const { lead, blocks } = parseCaseSummary(text);
  if (!String(text || '').trim()) return null;

  if (blocks.length < 2) {
    return (
      <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground ${className}`}>{text}</p>
    );
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {lead ? <p className="text-sm font-semibold text-foreground">{lead}</p> : null}
      {blocks.map((block, index) => {
        const style = SECTION_STYLE[block.key] || FALLBACK_STYLE;
        const Icon = style.icon;
        return (
          <section key={`${block.key}-${index}`} className={`rounded-xl border p-3 ${style.tone}`}>
            <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${style.accent}`}>
              <Icon className="h-3.5 w-3.5" />
              {block.display}
            </div>
            <div className="mt-2 text-sm leading-relaxed text-foreground">
              <SectionBody block={block} />
            </div>
          </section>
        );
      })}
    </div>
  );
}