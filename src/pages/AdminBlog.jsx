import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PostEditor from '@/components/blog/PostEditor';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, UploadCloud, Globe, FileText, Wand2 } from 'lucide-react';

export default function AdminBlog({ user }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [openAgent, setOpenAgent] = useState(false);
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);

  const isAdmin = user?.role === 'admin';

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['admin-blog-posts'],
    queryFn: async () => base44.entities.BlogPost.list('-updated_date', 200),
    staleTime: 15_000,
    enabled: isAdmin,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.slug || '').toLowerCase().includes(q) ||
      (p.excerpt || '').toLowerCase().includes(q)
    );
  }, [posts, search]);

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="border-0 shadow">
          <CardHeader><CardTitle>Acceso restringido</CardTitle></CardHeader>
          <CardContent>Esta sección es solo para administradores.</CardContent>
        </Card>
      </div>
    );
  }

  const upsert = async (data) => {
    setSaving(true);
    try {
      // Unicidad de slug
      const existing = await base44.entities.BlogPost.filter({ slug: data.slug });
      if (!editing && existing.length > 0) {
        toast.error('El slug ya existe. Usa otro.');
        return;
      }
      if (editing && existing.length > 0 && existing[0].id !== editing.id) {
        toast.error('El slug ya existe en otra entrada.');
        return;
      }

      if (editing) {
        await base44.entities.BlogPost.update(editing.id, data);
        toast.success('Entrada actualizada');
      } else {
        await base44.entities.BlogPost.create({ ...data, status: 'draft' });
        toast.success('Borrador creado');
      }
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['admin-blog-posts'] });
    } finally {
      setSaving(false);
    }
  };

  const publish = async (post) => {
    await base44.entities.BlogPost.update(post.id, { status: 'published', published_at: new Date().toISOString() });
    toast.success('Publicado');
    qc.invalidateQueries({ queryKey: ['admin-blog-posts'] });
  };

  const unpublish = async (post) => {
    await base44.entities.BlogPost.update(post.id, { status: 'draft' });
    toast.success('Pasado a borrador');
    qc.invalidateQueries({ queryKey: ['admin-blog-posts'] });
  };

  const remove = async (post) => {
    if (!confirm('¿Eliminar esta entrada?')) return;
    await base44.entities.BlogPost.delete(post.id);
    toast.success('Eliminada');
    qc.invalidateQueries({ queryKey: ['admin-blog-posts'] });
  };

  const generateWithAgent = async () => {
   setGenerating(true);
   try {
     const payload = topic.trim() ? { topic: topic.trim() } : {};
     const { data } = await base44.functions.invoke('generateDailyBlogPost', payload);
     if (data?.success) {
       toast.success('Borrador generado con el agente');
       setOpenAgent(false);
       setTopic('');
       qc.invalidateQueries({ queryKey: ['admin-blog-posts'] });
     } else if (data?.error) {
       toast.error(data.error || 'No se pudo generar el borrador');
     } else {
       toast.error('No se pudo generar el borrador');
     }
   } catch (e) {
     toast.error('Error al generar con el agente');
   } finally {
     setGenerating(false);
   }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Blog (Admin)</h1>
          <p className="text-slate-500 text-sm">Crear, editar y publicar artículos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
          <Button variant="outline" onClick={() => setOpenAgent(true)} className="gap-2">
            <Wand2 className="h-4 w-4" /> Generar con Agente
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-slate-600">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-slate-600">Sin resultados</div>
          ) : (
            <>
              <div className="divide-y md:hidden">
                {filtered.map((p) => (
                  <div key={p.id} className="p-4 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Título</p>
                      <p className="mt-1 font-medium text-slate-900 break-words">{p.title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Slug</p>
                      <p className="mt-1 text-sm text-slate-600 break-all">/{p.slug}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Estado</p>
                        <div className="mt-1">
                          {p.status === 'published' ? (
                            <Badge className="bg-emerald-100 text-emerald-700">Publicado</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-700">Borrador</Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Actualizado</p>
                        <p className="mt-1 text-sm text-slate-600 break-words">{new Date(p.updated_date).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4 mr-2" />Editar</Button>
                      {p.status === 'published' ? (
                        <Button variant="outline" onClick={() => unpublish(p)}><FileText className="h-4 w-4 mr-2" />Pasar a borrador</Button>
                      ) : (
                        <Button onClick={() => publish(p)} className="bg-green-600 hover:bg-green-700"><Globe className="h-4 w-4 mr-2" />Publicar</Button>
                      )}
                      <Button variant="destructive" onClick={() => remove(p)}><Trash2 className="h-4 w-4 mr-2" />Eliminar</Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Actualizado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.title}</TableCell>
                        <TableCell className="text-slate-500">/{p.slug}</TableCell>
                        <TableCell>
                          {p.status === 'published' ? (
                            <Badge className="bg-emerald-100 text-emerald-700">Publicado</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-700">Borrador</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-500">{new Date(p.updated_date).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            {p.status === 'published' ? (
                              <Button variant="outline" onClick={() => unpublish(p)}><FileText className="h-4 w-4 mr-1" />Borrador</Button>
                            ) : (
                              <Button onClick={() => publish(p)} className="bg-green-600 hover:bg-green-700"><Globe className="h-4 w-4 mr-1" />Publicar</Button>
                            )}
                            <Button variant="destructive" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={openAgent} onOpenChange={setOpenAgent}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generar con Agente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">Opcional: sugiere un tema para la investigación (ES/EN/中文). Si lo dejas vacío, el agente elegirá uno relevante.</p>
            <Input
              placeholder="Tema (opcional)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpenAgent(false)} disabled={generating}>Cancelar</Button>
              <Button onClick={generateWithAgent} disabled={generating} className="bg-indigo-600 hover:bg-indigo-700">
                {generating ? 'Generando…' : 'Generar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar entrada' : 'Nueva entrada'}</DialogTitle>
          </DialogHeader>
          <PostEditor post={editing} onSave={upsert} onCancel={() => setOpen(false)} saving={saving} />
        </DialogContent>
      </Dialog>
    </div>
  );
}