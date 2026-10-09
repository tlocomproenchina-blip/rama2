import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import WholesalerShipmentStatusCard from './WholesalerShipmentStatusCard';

// Consulta por paquete: se busca un tracking (o su código de etiqueta) y se ve si
// su aviso se envió al mayorista, con qué fotos y en qué intento.
export default function WholesalerShipmentSearch({ connectionId, onResent }) {
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const consult = async (event) => {
    event?.preventDefault();
    const search = term.trim();
    if (!search) {
      toast.info('Escribe un tracking para consultar.');
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('wholesalerShipments', {
        action: 'status',
        search,
        connection_id: connectionId || undefined,
      });
      setResult(res?.data || null);
    } catch (err) {
      toast.error(err?.message || 'No se pudo consultar el envío de esa carga.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-2xl border-0 shadow-card">
      <CardContent className="space-y-3 p-4">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Estado por paquete</h3>
          <p className="text-xs text-muted-foreground">
            Consulta un tracking o su código de etiqueta para ver si su aviso se envió al mayorista, con qué fotos y en qué intento.
          </p>
        </div>

        <form onSubmit={consult} className="flex flex-wrap gap-2">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Tracking o código de etiqueta"
            className="w-full sm:max-w-sm"
          />
          <Button type="submit" disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Consultar
          </Button>
        </form>

        {result && <WholesalerShipmentStatusCard status={result} onResent={onResent} />}
      </CardContent>
    </Card>
  );
}