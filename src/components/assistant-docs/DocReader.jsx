import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import DocSectionCard from "@/components/assistant-docs/DocSectionCard";
import DocSectionEditorBlock from "@/components/assistant-docs/DocSectionEditorBlock";

const emptySection = () => ({ heading: "", intro: "", paragraphs: [], items: [] });

// Cada sección se abre y se guarda por su cuenta: al guardar una, las demás
// quedan tal como estaban.
export default function DocReader({ sections, saving, onSaveSection, onRemoveSection }) {
  const list = sections || [];
  const [editingIndex, setEditingIndex] = useState(null);
  const [draft, setDraft] = useState(null);

  const startEdit = (index, section) => {
    setDraft(JSON.parse(JSON.stringify(section)));
    setEditingIndex(index);
  };
  const stopEdit = () => {
    setDraft(null);
    setEditingIndex(null);
  };

  const save = async () => {
    const ok = await onSaveSection(editingIndex, draft);
    if (ok) stopEdit();
  };
  const remove = async () => {
    const ok = await onRemoveSection(editingIndex);
    if (ok) stopEdit();
  };

  const adding = editingIndex !== null && editingIndex >= list.length;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Abre con «Editar» solo la sección que necesites. Al guardarla, las demás secciones quedan intactas.
      </p>

      {list.length === 0 && editingIndex === null ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Este documento todavía no tiene secciones.
        </div>
      ) : null}

      {list.map((section, index) =>
        editingIndex === index ? (
          <DocSectionEditorBlock
            key={index}
            section={draft}
            index={index}
            saving={saving}
            onChange={setDraft}
            onCancel={stopEdit}
            onSave={save}
            onRemove={remove}
          />
        ) : (
          <DocSectionCard
            key={index}
            section={section}
            index={index}
            canEdit={editingIndex === null}
            onEdit={() => startEdit(index, section)}
          />
        )
      )}

      {adding ? (
        <DocSectionEditorBlock
          section={draft}
          index={editingIndex}
          saving={saving}
          onChange={setDraft}
          onCancel={stopEdit}
          onSave={save}
        />
      ) : null}

      {editingIndex === null ? (
        <Button type="button" variant="outline" onClick={() => startEdit(list.length, emptySection())}>
          <Plus className="mr-2 h-4 w-4" /> Agregar sección
        </Button>
      ) : null}
    </div>
  );
}