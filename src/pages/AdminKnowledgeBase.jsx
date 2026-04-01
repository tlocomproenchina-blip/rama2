import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Pencil, Trash2, Upload, Globe } from "lucide-react";
import { toast } from "sonner";
import KbEditor from "@/components/knowledge-base/KbEditor.jsx";

const CATEGORIES = [
  { key: "general", label: "General" },
  { key: "envios", label: "Envíos" },
  { key: "pagos", label: "Pagos" },
  { key: "soporte", label: "Soporte" },
  { key: "faqs", label: "FAQs" },
  { key: "politicas", label: "Políticas" },
];

const STATUS = [
  { key: "draft", label: "Borrador" },
  { key: "published", label: "Publicado" },
  { key: "archived", label: "Archivado" },
];

export default function AdminKnowledgeBase({ user }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [cat, setCat] = useState("general");
  const [tagsText, setTagsText] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [docUrl, setDocUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Basic fetch; filters applied client-side for búsqueda
      const list = await base44.entities.KnowledgeBase.list("-updated_date", 200);
      setItems(list || []);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar la base de conocimiento");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return (items || []).filter(it => {
      const s1 = status === "all" || (it.status || "draft") === status;
      const s2 = category === "all" || (it.category || "general") === category;
      const text = `${it.title || ""} ${(it.tags || []).join(", ")}`.toLowerCase();
      const s3 = !q || text.includes(q.toLowerCase());
      return s1 && s2 && s3;
    });
  }, [items, status, category, q]);

  const resetForm = () => {
    setEditing(null);
    setTitle("");
    setContent("");
    setCat("general");
    setTagsText("");
    setDocFile(null);
    setDocUrl("");
  };

  const openCreate = () => { resetForm(); setOpen(true); };
  const openEdit = (it) => {
    setEditing(it);
    setTitle(it.title || "");
    setContent(it.content || "");
    setCat(it.category || "general");
    setTagsText((it.tags || []).join(", "));
    setDocUrl(it.document_url || "");
    setOpen(true);
  };

  const handleUpload = async () => {
    if (!docFile) return null;
    const { file_url } = await base44.integrations.Core.UploadFile({ file: docFile });
    setDocUrl(file_url);
    return file_url;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      let uploadedUrl = docUrl;
      if (docFile) {
        uploadedUrl = await handleUpload();
      }
      const payload = {
        title: title.trim(),
        content,
        category: cat,
        tags: tagsText.split(",").map(t => t.trim()).filter(Boolean),
        document_url: uploadedUrl || undefined,
        status: editing?.status || "draft",
      };
      if (!payload.title || !payload.content) {
        toast.error("Título y contenido son obligatorios");
        setSaving(false);
        return;
      }
      if (editing) {
        await base44.entities.KnowledgeBase.update(editing.id, payload);
        toast.success("Artículo actualizado");
      } else {
        await base44.entities.KnowledgeBase.create(payload);
        toast.success("Artículo creado");
      }
      setOpen(false);
      resetForm();
      await loadData();
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const setPublishState = async (it, next) => {
    try {
      await base44.entities.KnowledgeBase.update(it.id, { status: next });
      await loadData();
      toast.success(next === "published" ? "Publicado" : next === "draft" ? "Pasó a borrador" : "Archivado");
    } catch (e) {
      toast.error("Acción no completada");
    }
  };

  const handleDelete = async (it) => {
    if (!confirm("¿Eliminar este artículo?")) return;
    try {
      await base44.entities.KnowledgeBase.delete(it.id);
      await loadData();
      toast.success("Eliminado");
    } catch (e) {
      toast.error("No se pudo eliminar");
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Acceso restringido</CardTitle></CardHeader>
          <CardContent>Solo administradores pueden gestionar la Base de Conocimiento.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Base de Conocimiento</h1>
          <p className="text-slate-500">Gestiona artículos que el asistente usará para responder.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" /> Nuevo artículo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>Artículos</CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <Input placeholder="Buscar por título o tags" value={q} onChange={e => setQ(e.target.value)} className="w-52" />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {CATEGORIES.map(c => (<SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {STATUS.map(s => (<SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-16 flex items-center justify-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando...
            </div>
          ) : (
            <>
              <div className="divide-y md:hidden">
                {filtered.length === 0 ? (
                  <div className="text-center text-slate-500 p-6">Sin resultados</div>
                ) : (
                  filtered.map(it => (
                    <div key={it.id} className="p-4 space-y-3">
                      <div>
                        <p className="text-xs text-slate-500">Título</p>
                        <p className="mt-1 font-medium text-slate-900 break-words">{it.title}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-slate-500">Categoría</p>
                          <div className="mt-1">
                            <Badge className="bg-slate-100 text-slate-800">{CATEGORIES.find(c => c.key === (it.category || "general"))?.label || it.category}</Badge>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Estado</p>
                          <div className="mt-1">
                            <Badge className={
                              (it.status === "published" ? "bg-emerald-100 text-emerald-800" : it.status === "draft" ? "bg-yellow-100 text-yellow-800" : "bg-slate-200 text-slate-800")
                            }>
                              {STATUS.find(s => s.key === (it.status || "draft"))?.label || it.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Tags</p>
                        <p className="mt-1 text-sm text-slate-600 break-words">{(it.tags || []).slice(0,3).join(", ")}{(it.tags || []).length > 3 ? "…" : ""}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Actualizado</p>
                        <p className="mt-1 text-sm text-slate-600 break-words">{it.updated_date ? new Date(it.updated_date).toLocaleString() : "—"}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {it.document_url && (
                          <Button asChild variant="outline" size="sm">
                            <a href={it.document_url} target="_blank" rel="noreferrer"><Globe className="h-4 w-4 mr-2" />Ver doc</a>
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => openEdit(it)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </Button>
                        {it.status !== "published" && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setPublishState(it, "published")}>Publicar</Button>
                        )}
                        {it.status === "published" && (
                          <Button variant="secondary" size="sm" onClick={() => setPublishState(it, "draft")}>Despublicar</Button>
                        )}
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(it)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Actualizado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-500">Sin resultados</TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(it => (
                        <TableRow key={it.id}>
                          <TableCell className="font-medium">{it.title}</TableCell>
                          <TableCell>
                            <Badge className="bg-slate-100 text-slate-800">{CATEGORIES.find(c => c.key === (it.category || "general"))?.label || it.category}</Badge>
                          </TableCell>
                          <TableCell>{(it.tags || []).slice(0,3).join(", ")}{(it.tags || []).length > 3 ? "…" : ""}</TableCell>
                          <TableCell>
                            <Badge className={
                              (it.status === "published" ? "bg-emerald-100 text-emerald-800" : it.status === "draft" ? "bg-yellow-100 text-yellow-800" : "bg-slate-200 text-slate-800")
                            }>
                              {STATUS.find(s => s.key === (it.status || "draft"))?.label || it.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{it.updated_date ? new Date(it.updated_date).toLocaleString() : "—"}</TableCell>
                          <TableCell className="text-right space-x-1">
                            {it.document_url && (
                              <Button asChild variant="outline" size="sm">
                                <a href={it.document_url} target="_blank" rel="noreferrer"><Globe className="h-4 w-4 mr-1" />Ver doc</a>
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => openEdit(it)}>
                              <Pencil className="h-4 w-4 mr-1" /> Editar
                            </Button>
                            {it.status !== "published" && (
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setPublishState(it, "published")}>Publicar</Button>
                            )}
                            {it.status === "published" && (
                              <Button variant="secondary" size="sm" onClick={() => setPublishState(it, "draft")}>Despublicar</Button>
                            )}
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(it)}>
                              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar artículo" : "Nuevo artículo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. ¿Cómo funciona el DDP?" />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={cat} onValueChange={setCat}>
                  <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (<SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Contenido</Label>
              <KbEditor value={content} onChange={setContent} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Tags (separadas por coma)</Label>
                <Input value={tagsText} onChange={e => setTagsText(e.target.value)} placeholder="ddp, tarifas, envíos" />
              </div>
              <div>
                <Label>Documento adjunto (opcional)</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" onChange={e => setDocFile(e.target.files?.[0] || null)} />
                  {docUrl && (
                    <a href={docUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-sm">Abrir</a>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}