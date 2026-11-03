import React, { useEffect, useState } from 'react';
import { Loader2, Package as PackageIcon, HelpCircle, Boxes } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { unitKindLabel } from '@/lib/unitKind';

const fdate = (v) => (v ? new Date(v).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');

// Contenido de una caja consolidada o bulto suelto: cada paquete con su foto y datos,
// los códigos sin registrar y los bultos que la caja absorbió.
export default function BultoContentsDialog({ bulto, open, onClose }) {
  const [pkgs, setPkgs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !bulto) return;
    const ids = (bulto.package_ids || []).filter((id) => id && !String(id).startsWith('local_'));
    if (!ids.length) { setPkgs([]); return; }
    setLoading(true);
    base44.entities.Package.filter({ id: { $in: ids } }, '-received_date', ids.length)
      .then((rows) => setPkgs(rows))
      .finally(() => setLoading(false));
  }, [open, bulto]);

  if (!bulto) return null;
  const found = new Set(pkgs.map((p) => p.tracking_number));
  const unregistered = bulto.unregistered_codes || [];
  const pendingLocal = (bulto.package_trackings || []).filter((t) => t && !found.has(t) && !unregistered.includes(t));
  const absorbed = bulto.absorbed_bultos || [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{unitKindLabel(bulto)} · <span className="font-mono">{bulto.label_code}</span></DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando contenido…</p>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2">
              {pkgs.map((p) => {
                const photo = p.package_image_urls?.[0] || p.package_image_url;
                return (
                  <li key={p.id} className="flex gap-3 rounded-lg border border-border p-2">
                    {photo ? (
                      <a href={photo} target="_blank" rel="noreferrer" className="shrink-0">
                        <img src={photo} alt={p.tracking_number} className="h-16 w-16 rounded-md object-cover" />
                      </a>
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted"><PackageIcon className="h-5 w-5 text-slate-400" /></div>
                    )}
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="break-all font-mono text-sm font-semibold text-slate-800">{p.tracking_number}</p>
                      <p className="line-clamp-2 text-slate-600">{p.description || 'Sin descripción'}</p>
                      <p className="mt-0.5 text-slate-500">
                        Recibido {fdate(p.received_date)} · {p.actual_cbm ? `${Number(p.actual_cbm).toFixed(3)} CBM` : 'CBM —'}
                        {p.warehouse_location_code ? ` · Ubic. ${p.warehouse_location_code}` : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
              {pendingLocal.map((t) => (
                <li key={t} className="rounded-lg border border-dashed border-border p-2 text-xs">
                  <span className="break-all font-mono font-semibold text-slate-800">{t}</span>
                  <span className="ml-2 text-slate-500">Registro pendiente de sincronizar</span>
                </li>
              ))}
              {!pkgs.length && !pendingLocal.length && !unregistered.length && (
                <p className="text-sm text-slate-500">Esta unidad no tiene paquetes registrados.</p>
              )}
            </ul>

            {unregistered.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700"><HelpCircle className="h-3.5 w-3.5" /> Códigos sin registrar ({unregistered.length})</p>
                <div className="flex flex-wrap gap-1">
                  {unregistered.map((c) => <span key={c} className="break-all rounded bg-amber-50 px-2 py-0.5 font-mono text-xs text-amber-800">{c}</span>)}
                </div>
              </div>
            )}

            {absorbed.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-700"><Boxes className="h-3.5 w-3.5" /> Bultos absorbidos ({absorbed.length})</p>
                <ul className="space-y-1">
                  {absorbed.map((a, i) => (
                    <li key={`${a.label_code}-${i}`} className="rounded bg-muted/60 px-2 py-1 text-xs text-slate-600">
                      <span className="font-mono font-semibold">{a.label_code}</span> · {a.package_count || 0} paq. · {fdate(a.absorbed_at)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}