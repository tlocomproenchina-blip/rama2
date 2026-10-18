import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, RotateCcw, Save, X } from "lucide-react";
import { DOC_STATUS_OPTIONS } from "@/lib/assistantKnowledgeContent";

export default function DocEditToolbar({ doc, saving, onPatch, onSave, onCancel, onRestore }) {
  return (
    <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Estado del documento</Label>
          <Select value={doc.status || "borrador"} onValueChange={(value) => onPatch({ status: value })}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Nota de revisión (opcional)</Label>
          <Textarea
            rows={2}
            className="bg-white"
            value={doc.review_note || ""}
            onChange={(e) => onPatch({ review_note: e.target.value })}
            placeholder="Qué revisaste y qué falta confirmar"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar y registrar revisión
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="mr-2 h-4 w-4" /> Cancelar
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="text-slate-600">
              <RotateCcw className="mr-2 h-4 w-4" /> Restaurar borrador inicial
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Restaurar el borrador inicial?</AlertDialogTitle>
              <AlertDialogDescription>
                Se devuelven las secciones al texto con el que se armó este documento. Los cambios que no hayas
                guardado se pierden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onRestore}>Restaurar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}