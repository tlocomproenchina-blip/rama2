import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { ITEM_STATUS_OPTIONS } from "@/lib/assistantKnowledgeContent";

export default function DocItemEditor({ item, index, onChange, onRemove }) {
  const patch = (data) => onChange({ ...item, ...data });

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">Punto {index + 1}</span>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-rose-600" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <Textarea
        rows={2}
        value={item.text || ""}
        onChange={(e) => patch({ text: e.target.value })}
        placeholder="Escribe la regla o el punto"
      />
      <Input
        value={item.note || ""}
        onChange={(e) => patch({ note: e.target.value })}
        placeholder="Aclaratoria para quien revisa (opcional)"
      />

      <Select value={item.status || "pendiente"} onValueChange={(value) => patch({ status: value })}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ITEM_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.key} value={option.key}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}