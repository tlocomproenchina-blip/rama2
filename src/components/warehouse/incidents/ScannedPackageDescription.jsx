import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FileText, Loader2 } from 'lucide-react';

// Muestra la descripción que el cliente registró para el tracking buscado,
// para comparar con el contenido real de la caja.
export default function ScannedPackageDescription({ tracking }) {
  const [pkgs, setPkgs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = String(tracking || '').trim();
    if (t.length < 4) { setPkgs([]); return; }
    let cancel = false;
    setLoading(true);
    base44.entities.Package.filter({ tracking_number: t }, '-created_date', 5)
      .then((rows) => { if (!cancel) setPkgs(rows || []); })
      .catch(() => { if (!cancel) setPkgs([]); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [tracking]);

  if (loading) return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Buscando el paquete…</p>;
  if (!pkgs.length) return null;

  return (
    <div className="space-y-2">
      {pkgs.map((p) => (
        <div key={p.id} className="rounded-xl border border-primary/30 bg-accent/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <FileText className="h-3.5 w-3.5" /> Descripción del cliente
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{p.description || 'Sin descripción registrada'}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
            {p.tracking_number}{p.package_count ? ` · ${p.package_count} bulto(s)` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}