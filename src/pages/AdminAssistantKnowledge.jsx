import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import DocHeader from "@/components/assistant-docs/DocHeader";
import DocReader from "@/components/assistant-docs/DocReader";
import DocEditor from "@/components/assistant-docs/DocEditor";
import DocEditToolbar from "@/components/assistant-docs/DocEditToolbar";
import { DEFAULT_DOCS, DOC_TABS } from "@/lib/assistantKnowledgeContent";

export default function AdminAssistantKnowledge({ user }) {
  const [docs, setDocs] = useState(null);
  const [active, setActive] = useState("propuesta");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await base44.entities.AssistantDoc.filter({}, "-updated_date", 20);
      const list = Array.isArray(res) ? res : res?.items || [];
      const next = {};
      for (const key of Object.keys(DEFAULT_DOCS)) {
        const existing = list.find((row) => row.doc_key === key);
        next[key] = existing || (await base44.entities.AssistantDoc.create({ doc_key: key, ...DEFAULT_DOCS[key] }));
      }
      setDocs(next);
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron cargar los documentos");
      setDocs({});
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
          </CardHeader>
          <CardContent>Solo administradores pueden revisar estos documentos.</CardContent>
        </Card>
      </div>
    );
  }

  const current = docs?.[active] || null;
  const editing = !!draft && !!current && draft.doc_key === active;

  const startEdit = () => setDraft(JSON.parse(JSON.stringify(current)));
  const cancelEdit = () => setDraft(null);
  const patchDraft = (data) => setDraft((prev) => ({ ...prev, ...data }));
  const restoreDefaults = () => {
    setDraft((prev) => ({ ...prev, sections: JSON.parse(JSON.stringify(DEFAULT_DOCS[active].sections)) }));
    toast.info("Se cargó el borrador inicial. Guarda para aplicarlo.");
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await base44.entities.AssistantDoc.update(draft.id, {
        sections: draft.sections,
        status: draft.status,
        review_note: draft.review_note || "",
        last_reviewed_date: new Date().toISOString(),
        last_reviewed_by: user?.full_name || user?.email || "",
        updated_by: user?.email || "",
      });
      setDraft(null);
      toast.success("Documento guardado y revisión registrada");
      await load();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo guardar el documento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 pb-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Conocimiento del Asistente</h1>
        <p className="text-sm text-slate-500">
          Dos documentos para revisar: cómo se propone usar el conocimiento del sistema y qué reglas aplica hoy
          TLEC CARGO.
        </p>
      </div>

      {!docs ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando documentos...
        </div>
      ) : (
        <Tabs
          value={active}
          onValueChange={(value) => {
            setActive(value);
            setDraft(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            {DOC_TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {DOC_TABS.map((tab) => {
            const doc = docs[tab.key];
            if (!doc) {
              return (
                <TabsContent key={tab.key} value={tab.key} className="pt-4">
                  <Card>
                    <CardContent className="p-6 text-sm text-slate-500">
                      No se pudo cargar este documento. Recarga la página para intentarlo de nuevo.
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            }

            const isThisDraft = editing && draft.doc_key === tab.key;

            return (
              <TabsContent key={tab.key} value={tab.key} className="space-y-4 pt-4">
                <Card>
                  <CardContent className="space-y-4 p-4 md:p-5">
                    <DocHeader doc={isThisDraft ? draft : doc} />
                    {isThisDraft ? (
                      <DocEditToolbar
                        doc={draft}
                        saving={saving}
                        onPatch={patchDraft}
                        onSave={save}
                        onCancel={cancelEdit}
                        onRestore={restoreDefaults}
                      />
                    ) : (
                      <Button onClick={startEdit} className="w-full bg-blue-600 hover:bg-blue-700 md:w-auto">
                        <Pencil className="mr-2 h-4 w-4" /> Editar documento
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {isThisDraft ? (
                  <DocEditor sections={draft.sections} onChange={(sections) => patchDraft({ sections })} />
                ) : (
                  <DocReader sections={doc.sections} />
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}