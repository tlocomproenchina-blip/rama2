import DocStatusBadge from "@/components/assistant-docs/DocStatusBadge";

export default function DocItemRow({ item, index }) {
  return (
    <li className="flex gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <span className="w-6 shrink-0 pt-0.5 text-xs font-medium text-slate-400">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="break-words text-sm leading-relaxed text-slate-800">{item.text}</p>
        {item.note ? (
          <p className="break-words text-xs italic leading-relaxed text-slate-500">{item.note}</p>
        ) : null}
        <DocStatusBadge status={item.status} />
      </div>
    </li>
  );
}