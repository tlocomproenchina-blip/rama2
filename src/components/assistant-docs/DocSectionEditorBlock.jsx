import { Button } from "@/components/ui/button";
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
import { Loader2, Save, Trash2, X } from "lucide-react";
import DocEditorSection from "@/components/assistant-docs/DocEditorSection";

// Edición de una sola sección: se guarda únicamente esta, sin tocar las demás.
export default function DocSectionEditorBlock({ section, index, saving, onChange, onCancel, onSave, onRemove }) {
  return (
    <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/40 p-3 md:p-4">
      <DocEditorSection section={section} index={index} onChange={onChange} />

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar esta sección
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          <X className="mr-2 h-4 w-4" /> Cancelar
        </Button>

        {onRemove ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="text-rose-600" disabled={saving}>
                <Trash2 className="mr-2 h-4 w-4" /> Quitar sección
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Quitar esta sección del documento?</AlertDialogTitle>
                <AlertDialogDescription>
                  La sección {index + 1} se elimina del documento al confirmar. Las demás secciones no cambian.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove}>Quitar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </div>
  );
}