import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, PackageSearch } from 'lucide-react';
import PackageEditReviewCard from './PackageEditReviewCard';
import PackageEditRequestRow from '@/components/support/package-edit/PackageEditRequestRow';

// Bandeja de Supervisión para los cambios de paquete que envía el ATC desde el
// asistente. Se puede abrir por cliente (dentro de un caso) o completa.
export default function PackageEditReviewPanel({ clientEmail = '', user }) {
  const [pending, setPending] = useState([]);
  const [resolved, setResolved] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pendingQuery = { status: 'pendiente' };
      const resolvedQuery = { status: { $ne: 'pendiente' } };
      if (clientEmail) {
        pendingQuery.client_email = clientEmail;
        resolvedQuery.client_email = clientEmail;
      }
      const [pendingRows, resolvedRows] = await Promise.all([
        base44.entities.PackageEditRequest.filter(pendingQuery, '-requested_date', 50),
        base44.entities.PackageEditRequest.filter(resolvedQuery, '-reviewed_date', 8),
      ]);
      setPending(pendingRows || []);
      setResolved(resolvedRows || []);
    } catch {
      setPending([]);
      setResolved([]);
    } finally {
      setLoading(false);
    }
  }, [clientEmail]);

  useEffect(() => { load(); }, [load]);

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <PackageSearch className="h-4 w-4 text-primary" /> Cambios de paquete enviados por el ATC
          {pending.length > 0 ? <Badge className="bg-amber-100 text-amber-700">{pending.length} pendiente(s)</Badge> : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {clientEmail
            ? 'Tracking, monto del seguro, fecha de despacho e imágenes que el ATC corrigió para este cliente.'
            : 'Lo que el ATC corrigió desde la ficha del cliente: tracking, monto del seguro, fecha de despacho e imágenes.'}{' '}
          Revísalo y aplícalo para que quede en el paquete.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando solicitudes…
          </p>
        ) : pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            No hay cambios de paquete pendientes de supervisión.
          </p>
        ) : (
          pending.map((request) => (
            <PackageEditReviewCard key={request.id} request={request} user={user} onDone={load} />
          ))
        )}

        {resolved.length > 0 ? (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ya atendidas</p>
            {resolved.map((request) => <PackageEditRequestRow key={request.id} request={request} />)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}