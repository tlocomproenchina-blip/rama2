import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, PencilRuler, ShieldCheck } from 'lucide-react';
import PackageSearchList from './PackageSearchList';
import PackageEditRequestRow from './PackageEditRequestRow';

// Panel del ATC para corregir los datos de un paquete del cliente: se abre igual
// desde la ficha del cliente y desde el caso. Nada se aplica solo: cada envío
// queda pendiente de Supervisión.
export default function SupportPackageEditCard({ clientEmail, clientName, shippingMark = '', ticket = null, user }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientEmail) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await base44.entities.PackageEditRequest.filter({ client_email: clientEmail }, '-created_date', 30);
      setRequests(rows || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [clientEmail]);

  useEffect(() => { load(); }, [load]);

  const pending = requests.filter((row) => (row.status || 'pendiente') === 'pendiente').length;

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <PencilRuler className="h-4 w-4 text-primary" /> Datos del paquete para Supervisión
          {pending > 0 ? <Badge className="bg-amber-100 text-amber-700">{pending} pendiente(s)</Badge> : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Corrige el tracking, el monto del seguro, la fecha de despacho y adjunta las imágenes. Todo se envía a Supervisión y queda pendiente de revisión; la aprobación del seguro la sigue haciendo administración.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <PackageSearchList
          clientEmail={clientEmail}
          clientName={clientName}
          shippingMark={shippingMark}
          ticket={ticket}
          user={user}
          onSaved={load}
        />

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Solicitudes enviadas
          </p>
          {loading ? (
            <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando solicitudes…
            </p>
          ) : requests.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              Todavía no se han enviado cambios de paquete de este cliente.
            </p>
          ) : (
            requests.map((request) => <PackageEditRequestRow key={request.id} request={request} />)
          )}
        </div>
      </CardContent>
    </Card>
  );
}