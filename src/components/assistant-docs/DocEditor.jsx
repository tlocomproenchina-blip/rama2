import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import DocEditorSection from "@/components/assistant-docs/DocEditorSection";

export default function DocEditor({ sections, onChange }) {
  const list = sections || [];

  const addSection = () => {
    onChange([...list, { heading: "", intro: "", paragraphs: [], items: [] }]);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Edita el texto y marca el estado de cada punto. Guarda al final para registrar la revisión de hoy.
      </p>
      {list.map((section, index) => (
        <DocEditorSection
          key={index}
          section={section}
          index={index}
          onChange={(next) => onChange(list.map((s, i) => (i === index ? next : s)))}
          onRemove={() => onChange(list.filter((_, i) => i !== index))}
        />
      ))}
      <Button type="button" variant="outline" onClick={addSection}>
        <Plus className="mr-2 h-4 w-4" /> Agregar sección
      </Button>
    </div>
  );
}