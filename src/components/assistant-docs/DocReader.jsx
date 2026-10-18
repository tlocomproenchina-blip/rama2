import DocSectionCard from "@/components/assistant-docs/DocSectionCard";

export default function DocReader({ sections }) {
  if (!sections?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        Este documento todavía no tiene secciones.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <DocSectionCard key={index} section={section} index={index} />
      ))}
    </div>
  );
}