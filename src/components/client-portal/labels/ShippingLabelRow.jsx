import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Tag } from 'lucide-react';
import { toast } from 'sonner';

const up = (v) => String(v || '').trim().toUpperCase();

export default function ShippingLabelRow({ label, pkg, onLinked }) {
  const realTracking = pkg && up(pkg.tracking_number) !== up(label.label_code) ? pkg.tracking_number : '';
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!tracking.trim()) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('linkPackageLabel', { label_code: label.label_code, tracking_number: tracking.trim() });
      toast.success(res?.data?.merged ? 'Tracking vinculado y paquetes unificados' : 'Tracking vinculado a la etiqueta');
      setOpen(false);
      setTracking('');
      onLinked?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.data?.error || 'No se pudo vincular el tracking');
    }
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Tag className="h-4 w-4 text-primary shrink-0" />
        <span className="font-mono text-sm font-semibold text-foreground">{label.label_code}</span>
        {realTracking
          ? <Badge variant="outline" className="border-success/30 bg-success-bg text-success">Tracking {realTracking}</Badge>
          : <Badge variant="outline" className="border-warning/30 bg-warning-bg text-warning">Sin tracking</Badge>}
        {pkg?.status === 'recibido' && <Badge variant="outline">Recibido en almacén</Badge>}
        {!realTracking && !open && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setOpen(true)}>
            <Link2 className="h-4 w-4 mr-1" /> Asignar tracking
          </Button>
        )}
      </div>
      {label.content && <p className="text-xs text-muted-foreground line-clamp-1">{label.content}</p>}
      {open && (
        <div className="flex gap-2">
          <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Número de tracking" className="font-mono" />
          <Button onClick={save} disabled={saving || !tracking.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
        </div>
      )}
    </div>
  );
}