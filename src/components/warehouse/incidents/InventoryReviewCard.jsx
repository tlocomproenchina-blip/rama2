import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import IncidentClientSearch from './IncidentClientSearch';
import InventoryUnitRow from './InventoryUnitRow';

// Revisión del contenido de las cajas de un cliente al llegar el contenedor.
export default function InventoryReviewCard({ onChanged }) {
  const [container, setContainer] = useState('');
  const [code, setCode] = useState('');
  const [client, setClient] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!client?.email) { setUnits([]); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('cajaInventoryReview', { action: 'list', client_email: client.email });
      setUnits((res?.data || res)?.units || []);
    } finally {
      setLoading(false);
    }
  }, [client?.email]);

  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-primary" /> Revisar inventario del cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="inv-container">N° de contenedor</Label>
            <Input id="inv-container" value={container} onChange={(e) => setContainer(e.target.value.toUpperCase())} placeholder="Ej: TLLU1234567" />
          </div>
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <IncidentClientSearch
              code={code}
              client={client}
              onCodeChange={setCode}
              onSelect={(item) => { setClient(item); setCode(item.shipping_mark || ''); }}
              onClear={() => setClient(null)}
            />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : client && !units.length ? (
          <p className="text-sm text-muted-foreground">Este cliente no tiene cajas ni bultos registrados.</p>
        ) : (
          <div className="space-y-3">
            {units.map((u) => (
              <InventoryUnitRow key={u.id} unit={u} container={container} onReviewed={() => { load(); onChanged?.(); }} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}