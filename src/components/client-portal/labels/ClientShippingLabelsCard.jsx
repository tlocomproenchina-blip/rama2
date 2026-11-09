import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Tag } from 'lucide-react';
import ShippingLabelRow from './ShippingLabelRow';

// Etiquetas de envío del cliente con el paquete que tiene vinculado cada una.
export default function ClientShippingLabelsCard({ user, packages, onLinked }) {
  const [labels, setLabels] = useState([]);
  const [search, setSearch] = useState('');

  const load = async () => {
    if (!user?.email) return;
    const rows = await base44.entities.ShippingLabel.filter({ client_email: user.email }, '-created_date', 200);
    setLabels(rows || []);
  };

  useEffect(() => { load(); }, [user?.email]);

  const pkgFor = (label) => packages.find((p) => p.id === label.linked_package_id)
    || packages.find((p) => String(p.label_code || '').toUpperCase() === String(label.label_code).toUpperCase());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return labels;
    return labels.filter((l) => [l.label_code, l.content, pkgFor(l)?.tracking_number]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }, [labels, search, packages]);

  if (!labels.length) return null;

  return (
    <Card className="border-border/70 bg-card/95 shadow-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <h2 className="font-display text-base font-semibold">Mis etiquetas de envío</h2>
            <span className="text-xs text-muted-foreground">({labels.length})</span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar etiqueta o tracking..." className="pl-10" />
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2 max-h-96 overflow-y-auto">
          {filtered.map((label) => (
            <ShippingLabelRow key={label.id} label={label} pkg={pkgFor(label)} onLinked={() => { load(); onLinked?.(); }} />
          ))}
          {!filtered.length && <p className="text-sm text-muted-foreground">No hay etiquetas con ese criterio.</p>}
        </div>
      </CardContent>
    </Card>
  );
}