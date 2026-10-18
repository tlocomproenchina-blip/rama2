import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import DocItemEditor from "@/components/assistant-docs/DocItemEditor";

export default function DocEditorSection({ section, index, onChange, onRemove }) {
  const patch = (data) => onChange({ ...section, ...data });
  const paragraphs = section.paragraphs || [];
  const items = section.items || [];

  const setParagraph = (i, value) => {
    const next = [...paragraphs];
    next[i] = value;
    patch({ paragraphs: next });
  };

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sección {index + 1}
        </span>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-rose-600" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Input
        value={section.heading || ""}
        onChange={(e) => patch({ heading: e.target.value })}
        placeholder="Título de la sección"
      />
      <Textarea
        rows={2}
        value={section.intro || ""}
        onChange={(e) => patch({ intro: e.target.value })}
        placeholder="Párrafo que abre la sección (opcional)"
      />

      {paragraphs.map((paragraph, i) => (
        <div key={i} className="flex gap-2">
          <Textarea rows={2} value={paragraph} onChange={(e) => setParagraph(i, e.target.value)} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-rose-600"
            onClick={() => patch({ paragraphs: paragraphs.filter((_, idx) => idx !== i) })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={() => patch({ paragraphs: [...paragraphs, ""] })}>
        <Plus className="mr-2 h-4 w-4" /> Agregar párrafo
      </Button>

      <div className="space-y-2">
        {items.map((item, i) => (
          <DocItemEditor
            key={i}
            item={item}
            index={i}
            onChange={(next) => patch({ items: items.map((it, idx) => (idx === i ? next : it)) })}
            onRemove={() => patch({ items: items.filter((_, idx) => idx !== i) })}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => patch({ items: [...items, { text: "", status: "pendiente", note: "" }] })}
      >
        <Plus className="mr-2 h-4 w-4" /> Agregar punto
      </Button>
    </section>
  );
}