import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import DocHeader from "@/components/assistant-docs/DocHeader";
import DocReader from "@/components/assistant-docs/DocReader";
import DocReviewPanel from "@/components/assistant-docs/DocReviewPanel";
import { DEFAULT_DOCS, DOC_TABS } from "@/lib/assistantKnowledgeContent";

export default function AdminAssistantKnowledge({ user }) {
  const [docs, setDocs] = useState(null);
  const [active, setActive] = useState("propuesta");
  const [review, setReview] = useState(null);
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

  // Estado y nota son del documento completo: se editan aparte de las secciones.
  const metaDraft =
    review?.doc_key === active
      ? review
      : { doc_key: active, status: current?.status || "borrador", review_note: current?.review_note || "" };

  const patchMeta = (data) => setReview({ ...metaDraft, ...data });

  const reviewStamp = () => ({
    last_reviewed_date: new Date().toISOString(),
    last_reviewed_by: user?.full_name || user?.email || "",
    updated_by: user?.email || "",
  });

  // Guarda SOLO la sección que se editó: el resto del documento queda intacto.
  const saveSection = async (index, section) => {
    if (!current || !section) return false;
    setSaving(true);
    try {
      const base = Array.isArray(current.sections) ? current.sections : [];
      const sections =
        index < base.length ? base.map((s, i) => (i === index ? section : s)) : [...base, section];
      await base44.entities.AssistantDoc.update(current.id, { sections, ...reviewStamp() });
      toast.success(index < base.length ? "Sección guardada" : "Sección agregada");
      await load();
      return true;
    } catch (error) {
      console.error(error);
      toast.error("No se pudo guardar la sección");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeSection = async (index) => {
    if (!current) return false;
    setSaving(true);
    try {
      const sections = (Array.isArray(current.sections) ? current.sections : []).filter((_, i) => i !== index);
      await base44.entities.AssistantDoc.update(current.id, { sections, ...reviewStamp() });
      toast.success("Sección quitada del documento");
      await load();
      return true;
    } catch (error) {
      console.error(error);
      toast.error("No se pudo quitar la sección");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveReview = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await base44.entities.AssistantDoc.update(current.id, {
        status: metaDraft.status,
        review_note: metaDraft.review_note || "",
        ...reviewStamp(),
      });
      setReview(null);
      toast.success("Estado y nota de revisión guardados");
      await load();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo guardar la revisión del documento");
    } finally {
      setSaving(false);
    }
  };

  const restoreDefaults = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await base44.entities.AssistantDoc.update(current.id, {
        sections: JSON.parse(JSON.stringify(DEFAULT_DOCS[active].sections)),
        ...reviewStamp(),
      });
      toast.success("Se restauró el borrador inicial del documento");
      await load();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo restaurar el borrador inicial");
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
          TLEC CARGO. Cada sección se edita por separado.
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
            setReview(null);
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

            return (
              <TabsContent key={tab.key} value={tab.key} className="space-y-4 pt-4">
                <Card>
                  <CardContent className="space-y-4 p-4 md:p-5">
                    <DocHeader doc={doc} />
                    <DocReviewPanel
                      meta={metaDraft}
                      saving={saving}
                      onPatch={patchMeta}
                      onSave={saveReview}
                      onCancel={() => setReview(null)}
                      onRestore={restoreDefaults}
                    />
                  </CardContent>
                </Card>

                <DocReader
                  sections={doc.sections}
                  saving={saving}
                  onSaveSection={saveSection}
                  onRemoveSection={removeSection}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}