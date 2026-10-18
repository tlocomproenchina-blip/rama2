import DocItemRow from "@/components/assistant-docs/DocItemRow";

export default function DocSectionCard({ section, index }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {index + 1}
        </span>
        <h3 className="text-base font-semibold leading-snug text-slate-900">{section.heading}</h3>
      </div>

      {section.intro ? (
        <p className="mt-3 break-words text-sm leading-relaxed text-slate-600">{section.intro}</p>
      ) : null}

      {(section.paragraphs || []).map((paragraph, i) => (
        <p key={i} className="mt-3 break-words text-sm leading-relaxed text-slate-600">
          {paragraph}
        </p>
      ))}

      {(section.items || []).length > 0 ? (
        <ul className="mt-3">
          {section.items.map((item, i) => (
            <DocItemRow key={i} item={item} index={i} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}