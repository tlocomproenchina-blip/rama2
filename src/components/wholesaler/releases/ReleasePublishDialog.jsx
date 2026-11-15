import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

export default function ReleasePublishDialog({ release, connections, onClose, onDone }) {
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSel(connections.map((c) => c.config_key || 'main')); }, [release, connections]);

  const publish = async () => {
    if (!sel.length) return toast.error('Elige al menos un mayorista.');
    setBusy(true);
    try {
      const existing = await base44.entities.WholesalerReleaseStatus.filter({ release_id: release.id });
      const have = new Set(existing.map((s) => s.wholesaler_key));
      const rows = connections.filter((c) => sel.includes(c.config_key || 'main') && !have.has(c.config_key || 'main'))
        .map((c) => ({ release_id: release.id, version: release.version, wholesaler_key: c.config_key || 'main', wholesaler_name: c.wholesaler_name, status: 'pendiente' }));
      if (rows.length) await base44.entities.WholesalerReleaseStatus.bulkCreate(rows);
      await base44.entities.AppRelease.update(release.id, { status: 'publicada', recipients: sel, published_date: new Date().toISOString() });
      toast.success('Versión publicada.');
      onDone();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!release} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Publicar {release?.version}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {connections.map((c) => {
            const k = c.config_key || 'main';
            return (
              <label key={k} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                <Checkbox checked={sel.includes(k)} onCheckedChange={(v) => setSel((p) => v ? [...p, k] : p.filter((x) => x !== k))} />
                {c.wholesaler_name || k}
              </label>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={publish} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Publicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}