import { Badge } from "@/components/ui/badge";

const STYLES = {
  confirmado: "bg-emerald-100 text-emerald-800",
  provisional: "bg-amber-100 text-amber-800",
  pendiente: "bg-rose-100 text-rose-800",
  borrador: "bg-slate-100 text-slate-700",
  en_revision: "bg-amber-100 text-amber-800",
  validado: "bg-emerald-100 text-emerald-800",
};

const LABELS = {
  confirmado: "Confirmado",
  provisional: "Provisional",
  pendiente: "Pendiente de validación",
  borrador: "Borrador",
  en_revision: "En revisión",
  validado: "Validado",
};

export default function DocStatusBadge({ status }) {
  return (
    <Badge className={`${STYLES[status] || "bg-slate-100 text-slate-700"} border-0 font-medium`}>
      {LABELS[status] || status}
    </Badge>
  );
}