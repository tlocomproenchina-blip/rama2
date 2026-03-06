import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';

function slugify(text) {
  return (text || '')
    .toString()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function PostEditor({ post, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    cover_image_url: '',
    tags: '',
    seo_title: '',
    seo_description: '',
    canonical_url: '',
  });
  const [readingTime, setReadingTime] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (post) {
      setForm({
        title: post.title || '',
        slug: post.slug || '',
        excerpt: post.excerpt || '',
        content: post.content || '',
        cover_image_url: post.cover_image_url || '',
        tags: (post.tags || []).join(', '),
        seo_title: post.seo_title || '',
        seo_description: post.seo_description || '',
        canonical_url: post.canonical_url || '',
      });
      setReadingTime(post.reading_time_minutes || 0);
    }
  }, [post]);

  useEffect(() => {
    const words = (form.content || '').split(/\s+/).filter(Boolean).length;
    setReadingTime(Math.max(1, Math.round(words / 200)));
  }, [form.content]);

  const handleChange = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleAutoSlug = () => handleChange('slug', slugify(form.title));

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      handleChange('cover_image_url', file_url);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const payload = {
      ...form,
      tags: form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      reading_time_minutes: readingTime,
    };
    await onSave(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{post ? 'Editar entrada' : 'Nueva entrada'}</h3>
        <Badge variant="outline">{post?.status || 'draft'}</Badge>
      </div>

      <div className="space-y-2">
        <Label>Título</Label>
        <Input value={form.title} onChange={(e) => handleChange('title', e.target.value)} />
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input value={form.slug} onChange={(e) => handleChange('slug', e.target.value)} />
        </div>
        <Button variant="outline" onClick={handleAutoSlug}>Generar slug</Button>
      </div>

      <div className="space-y-2">
        <Label>Resumen (excerpt)</Label>
        <Textarea rows={3} value={form.excerpt} onChange={(e) => handleChange('excerpt', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Contenido</Label>
        <Textarea rows={8} value={form.content} onChange={(e) => handleChange('content', e.target.value)} />
        <p className="text-xs text-slate-500">Tiempo estimado de lectura: {readingTime} min</p>
      </div>

      <div className="space-y-2">
        <Label>Imagen de portada</Label>
        <div className="flex items-center gap-3">
          <Input placeholder="https://..." value={form.cover_image_url} onChange={(e) => handleChange('cover_image_url', e.target.value)} />
          <label className="inline-flex items-center gap-2">
            <input type="file" accept="image/*" onChange={(e) => handleUpload(e.target.files?.[0])} hidden id="cover_upload_input" />
            <Button asChild variant="outline" disabled={uploading}>
              <label htmlFor="cover_upload_input">{uploading ? 'Subiendo…' : 'Subir'}</label>
            </Button>
          </label>
        </div>
        {form.cover_image_url && (
          <img src={form.cover_image_url} alt="cover" className="h-32 w-full object-cover rounded border" />
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tags (separados por coma)</Label>
          <Input value={form.tags} onChange={(e) => handleChange('tags', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Canonical URL</Label>
          <Input value={form.canonical_url} onChange={(e) => handleChange('canonical_url', e.target.value)} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>SEO Title</Label>
          <Input value={form.seo_title} onChange={(e) => handleChange('seo_title', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>SEO Description</Label>
          <Input value={form.seo_description} onChange={(e) => handleChange('seo_description', e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={submit} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </div>
  );
}