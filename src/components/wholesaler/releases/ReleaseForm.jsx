import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus } from 'lucide-react';

const SCOPES = [['interfaz', 'Pantallas'], ['funciones', 'Funciones del servidor'], ['estructura', 'Estructura de datos']];

export default function ReleaseForm({ onCreated }) {
  const [f, setF] = useState({ version: '', title: '', notes: '', repo_ref: '', scope: ['interfaz'] });
  const [saving, setSaving] = useState(false);
  const toggle = (s) => setF((p) => ({ ...p, scope: p.scope.includes(s) ? p.scope.filter((x) => x !== s) : [...p.scope, s] }));

  const save = async () => {
    if (!f.version.trim() || !f.repo_ref.trim()) return toast.error('Indica la versión y la etiqueta o commit.');
    setSaving(true);
    try {
      await base44.entities.AppRelease.create({ ...f, version: f.version.trim(), repo_ref: f.repo_ref.trim(), status: 'borrador' });
      setF({ version: '', title: '', notes: '', repo_ref: '', scope: ['interfaz'] });
      toast.success('Versión creada en borrador.');
      onCreated();
    } finally { setSaving(false); }
  };

  return (
    <Card><CardContent className="space-y-3 p-5">
      <p className="font-display font-semibold">Nueva versión</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input placeholder="Versión (ej: v1.4.0)" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />
        <Input placeholder="Título" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Input placeholder="Etiqueta o commit de GitHub" value={f.repo_ref} onChange={(e) => setF({ ...f, repo_ref: e.target.value })} />
      </div>
      <Textarea rows={3} placeholder="Correcciones y cambios incluidos" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <div className="flex flex-wrap items-center gap-2">
        {SCOPES.map(([k, l]) => (
          <button key={k} type="button" onClick={() => toggle(k)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${f.scope.includes(k) ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground'}`}>{l}</button>
        ))}
        <Button onClick={save} disabled={saving} className="ml-auto gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear versión
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Nunca se distribuyen secretos, claves, datos de clientes ni registros operativos.</p>
    </CardContent></Card>
  );
}