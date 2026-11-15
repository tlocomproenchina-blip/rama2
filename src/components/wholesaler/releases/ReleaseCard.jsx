import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Send, Trash2 } from 'lucide-react';

const TONE = {
  borrador: 'bg-muted text-muted-foreground', validada: 'bg-warning-bg text-warning', publicada: 'bg-success-bg text-success',
  pendiente: 'bg-muted text-muted-foreground', recibida: 'bg-info-bg text-info', aplicada: 'bg-success-bg text-success', fallida: 'bg-red-50 text-destructive',
};

export default function ReleaseCard({ release, statuses, onValidate, onPublish, onDelete }) {
  return (
    <Card><CardContent className="space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-lg font-semibold">{release.version}</span>
        <Badge className={TONE[release.status]}>{release.status}</Badge>
        <span className="text-sm text-muted-foreground">{release.title}</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{release.repo_ref}</span>
      </div>
      {release.notes && <p className="whitespace-pre-line text-sm">{release.notes}</p>}
      <div className="flex flex-wrap gap-2">
        {release.status === 'borrador' && <>
          <Button size="sm" variant="outline" className="gap-2" onClick={onValidate}><CheckCircle2 className="h-4 w-4" />Marcar validada</Button>
          <Button size="sm" variant="ghost" className="gap-2" onClick={onDelete}><Trash2 className="h-4 w-4" />Eliminar</Button>
        </>}
        {release.status !== 'borrador' && <Button size="sm" className="gap-2" onClick={onPublish}><Send className="h-4 w-4" />{release.status === 'publicada' ? 'Agregar mayoristas' : 'Publicar'}</Button>}
      </div>
      {statuses.length > 0 && (
        <div className="divide-y rounded-xl border">
          {statuses.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
              <span className="font-medium">{s.wholesaler_name || s.wholesaler_key}</span>
              <Badge className={TONE[s.status]}>{s.status}</Badge>
              {s.message && <span className="text-xs text-muted-foreground">{s.message}</span>}
            </div>
          ))}
        </div>
      )}
    </CardContent></Card>
  );
}