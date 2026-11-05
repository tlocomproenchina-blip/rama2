import React, { useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Trackings del bulto con un ojito que abre las fotos de recepción del paquete.
export default function BultoTrackingPhotos({ bulto }) {
  const trackings = [...new Set((bulto.package_trackings || []).filter(Boolean))];
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);

  if (!trackings.length) return null;

  const view = async (tracking) => {
    setOpen(tracking);
    setLoading(true);
    setImages([]);
    const rows = await base44.entities.Package.filter({ tracking_number: tracking }, '-updated_date', 5);
    const urls = rows.flatMap((p) => [...(p.package_image_urls || []), p.package_image_url]).filter(Boolean);
    setImages([...new Set(urls)]);
    setLoading(false);
  };

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {trackings.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 pl-2 text-xs font-mono text-slate-600">
          {t}
          <button type="button" onClick={() => view(t)} className="rounded-r-md px-1.5 py-1 text-blue-600 hover:bg-blue-50" aria-label="Ver foto">
            <Eye className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-mono text-sm">{open}</DialogTitle></DialogHeader>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : images.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {images.map((u) => (
                <a key={u} href={u} target="_blank" rel="noreferrer">
                  <img src={u} alt={`Foto ${open}`} className="w-full rounded-lg border object-contain max-h-96" />
                </a>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No hay foto disponible para este paquete.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}