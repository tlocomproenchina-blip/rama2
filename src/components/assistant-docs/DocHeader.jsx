import DocStatusBadge from "@/components/assistant-docs/DocStatusBadge";
import { countByStatus } from "@/lib/assistantKnowledgeContent";

const formatDate = (value) => (value ? new Date(value).toLocaleString() : "sin revisar todavía");

export default function DocHeader({ doc }) {
  const counts = countByStatus(doc?.sections);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DocStatusBadge status={doc.status || "borrador"} />
        <span className="text-xs text-slate-500">{doc.version || "v0.1"}</span>
      </div>

      <h2 className="text-lg font-semibold leading-snug text-slate-900">{doc.title}</h2>
      {doc.subtitle ? <p className="text-sm text-slate-600">{doc.subtitle}</p> : null}
      {doc.purpose ? (
        <p className="rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">{doc.purpose}</p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
          {counts.confirmado} confirmados
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
          {counts.provisional} provisionales
        </span>
        <span className="rounded-full bg-rose-50 px-3 py-1 font-medium text-rose-700">
          {counts.pendiente} por validar
        </span>
      </div>

      <p className="text-xs text-slate-500">
        Última revisión: {formatDate(doc.last_reviewed_date)}
        {doc.last_reviewed_by ? ` · ${doc.last_reviewed_by}` : ""}
      </p>
      {doc.review_note ? (
        <p className="break-words text-xs italic leading-relaxed text-slate-500">Nota de revisión: {doc.review_note}</p>
      ) : null}
    </div>
  );
}