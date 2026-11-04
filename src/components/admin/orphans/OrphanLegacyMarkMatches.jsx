import React, { useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Badge } from '@/components/ui/badge';
import { History, Loader2 } from 'lucide-react';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Busca el código escrito entre los Shipping Mark anteriores a la migración y
// ofrece el cliente actual al que pasó ese código.
export default function OrphanLegacyMarkMatches({ query, onSelect }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = String(query || '').trim();
    if (q.length < 3) { setMatches([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const page = await base44.entities.ShippingMarkMigration.filter(
          { old_mark: { $regex: escapeRegex(q), $options: 'i' }, status: 'migrado' },
          { sort: '-created_date', limit: 8 }
        );
        if (!cancel) setMatches(page?.items || page || []);
      } catch (_) {
        if (!cancel) setMatches([]);
      }
      if (!cancel) setLoading(false);
    }, 400);
    return () => { cancel = true; clearTimeout(t); };
  }, [query]);

  if (loading) {
    return <p className="flex items-center gap-2 text-xs text-slate-500 py-1"><Loader2 className="h-3 w-3 animate-spin" /> Buscando en códigos anteriores...</p>;
  }
  if (matches.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700"><History className="h-3.5 w-3.5" /> Coincide con un Shipping Mark anterior</p>
      <div className="border border-amber-200 rounded-lg divide-y">
        {matches.map((m) => (
          <button
            key={m.id}
            onClick={() => onSelect({ id: m.user_id, email: m.client_email, full_name: m.client_name, shipping_mark: m.new_mark })}
            className="w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">{m.client_name || m.client_email}</p>
              <p className="text-xs text-slate-500 truncate">{m.client_email}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-[10px]">
              <Badge variant="outline" className="line-through text-slate-400">{m.old_mark}</Badge>
              <span className="text-slate-400">→</span>
              <Badge variant="outline" className="text-[10px]">{m.new_mark}</Badge>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}