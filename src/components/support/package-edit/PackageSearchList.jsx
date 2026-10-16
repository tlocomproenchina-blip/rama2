import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PencilLine, Search } from 'lucide-react';
import PackageEditRequestDialog from './PackageEditRequestDialog';

const STATUS = {
  pre_alerta: 'Pre-alerta',
  recibido: 'Recibido',
  rechazado: 'Rechazado',
  consolidado: 'Consolidado',
  en_transito: 'En tránsito',
  disponible: 'Disponible en Venezuela',
  despachado: 'Despachado',
  entregado: 'Entregado',
  sin_cliente: 'Sin cliente',
};

// Paquetes del cliente listos para corregir: se busca por tracking y se abre el
// formulario que envía los cambios a Supervisión.
export default function PackageSearchList({ clientEmail, clientName, shippingMark, ticket, user, onSaved }) {
  const [term, setTerm] = useState('');
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    if (!clientEmail) {
      setPackages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const query = { client_email: clientEmail };
      const clean = term.trim();
      if (clean) query.tracking_number = { $regex: clean, $options: 'i' };
      const rows = await base44.entities.Package.filter(query, '-created_date', 20);
      setPackages(rows || []);
    } catch {
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [clientEmail, term]);

  useEffect(() => {
    const timer = setTimeout(load, term ? 400 : 0);
    return () => clearTimeout(timer);
  }, [load, term]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Buscar el paquete por tracking…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando paquetes…
        </p>
      ) : packages.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          No hay paquetes que coincidan con esa búsqueda.
        </p>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {packages.map((pkg) => (
            <li key={pkg.id} className="flex items-center justify-between gap-2 rounded-2xl border border-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-semibold text-foreground">{pkg.tracking_number}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {STATUS[pkg.status] || pkg.status}{pkg.description ? ` · ${pkg.description}` : ''}
                </p>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => setSelected(pkg)}>
                <PencilLine className="mr-1.5 h-3.5 w-3.5" /> Editar datos
              </Button>
            </li>
          ))}
        </ul>
      )}

      <PackageEditRequestDialog
        open={!!selected}
        onOpenChange={(next) => { if (!next) setSelected(null); }}
        pkg={selected}
        clientEmail={clientEmail}
        clientName={clientName}
        shippingMark={shippingMark}
        ticket={ticket}
        user={user}
        onSaved={onSaved}
      />
    </div>
  );
}