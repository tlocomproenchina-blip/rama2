import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, ArrowRightLeft } from 'lucide-react';
import ShippingMarkMigrationResults from './ShippingMarkMigrationResults';

// Migración de la serie 50000+ a la serie 5000 (continúa en 5011).
export default function ShippingMarkMigrationCard() {
  const [preview, setPreview] = useState(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');

  const invoke = async (payload) => (await base44.functions.invoke('migrateShippingMarkSeries', payload)).data;
  const loadPreview = async () => setPreview(await invoke({ action: 'preview' }));
  const loadRecords = async () => setRecords((await invoke({ action: 'list' })).records);

  useEffect(() => { loadPreview(); }, []);

  const run = async () => {
    const msg = `Se migrarán ${preview.pending} clientes de la serie 50000+ a la serie 5000, empezando en ${preview.next_number}. Sus paquetes, recibos, bultos y demás registros pasarán al nuevo Shipping Mark. ¿Continuar?`;
    if (!window.confirm(msg)) return;
    setRunning(true); setError(''); setDone(0); setTotal(preview.pending);
    let remaining = preview.pending;
    let count = 0;
    let stalled = 0;
    try {
      while (remaining > 0 && stalled < 3) {
        const res = await invoke({ action: 'run', batch_size: 6 });
        const ok = res.processed.filter((p) => p.status === 'migrado').length;
        count += res.processed.length;
        stalled = ok === 0 ? stalled + 1 : 0;
        remaining = res.remaining;
        setDone(count);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'No se pudo completar la migración. Puedes reanudarla.');
    }
    setRunning(false);
    await Promise.all([loadPreview(), loadRecords()]);
  };

  return (
    <div className="mt-8 space-y-4 rounded-xl border border-border bg-accent/40 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-semibold text-foreground">Migrar serie 50000 a serie 5000</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Reasigna los Shipping Marks desde 50000 en adelante a la serie 5000, en orden, continuando el consecutivo. Cada cliente conserva su código de estado (N1–N7) y todos sus registros. Las etiquetas ya impresas siguen funcionando al escanearlas.
      </p>
      {!preview ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculando alcance…</p>
      ) : (
        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg bg-card p-3"><p className="text-muted-foreground">Por migrar</p><p className="text-xl font-semibold">{preview.pending}</p></div>
          <div className="rounded-lg bg-card p-3"><p className="text-muted-foreground">Ya migrados</p><p className="text-xl font-semibold">{preview.migrated}</p></div>
          <div className="rounded-lg bg-card p-3"><p className="text-muted-foreground">Próximo número</p><p className="text-xl font-semibold">{preview.next_number}</p></div>
        </div>
      )}
      {running && (
        <div className="space-y-1">
          <Progress value={total ? (done / total) * 100 : 0} />
          <p className="text-xs text-muted-foreground">{done} de {total} clientes procesados…</p>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={running || !preview?.pending}>
          {running && <Loader2 className="h-4 w-4 animate-spin" />}
          {preview?.migrated ? 'Continuar migración' : 'Iniciar migración'}
        </Button>
        <Button variant="outline" onClick={loadRecords} disabled={running}>Ver resultados</Button>
      </div>
      {records && <ShippingMarkMigrationResults records={records} />}
    </div>
  );
}