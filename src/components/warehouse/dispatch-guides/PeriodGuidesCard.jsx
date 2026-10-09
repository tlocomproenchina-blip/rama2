import React, { useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileStack, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generatePeriodGuidesPdf } from '@/lib/periodGuidesPdf';
import PeriodGuidesSummary from './PeriodGuidesSummary';

// Guías de despacho de un período pagado: se eligen las fechas (fecha de pago, hora de
// Caracas), se genera una guía individual por cliente —las mismas órdenes y unidades de
// la Orden de Despacho del período—, cada una queda guardada con su número en el
// historial y todas salen juntas en un solo PDF para imprimir.
export default function PeriodGuidesCard({ onGenerated }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appName, setAppName] = useState('TLEC CARGO');
  const [running, setRunning] = useState(false);
  const [printing, setPrinting] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1)
      .then((rows) => {
        if (rows?.[0]?.app_name) setAppName(rows[0].app_name);
      })
      .catch(() => {});
  }, []);

  const handlePdf = async (data, mode) => {
    if (!data?.guides?.length) return;
    setPrinting(mode);
    try {
      await generatePeriodGuidesPdf({
        guides: data.guides,
        appName,
        mode,
        periodFrom: data.from,
        periodTo: data.to,
      });
    } catch (_) {
      toast.error('No se pudo armar el PDF de las guías');
    }
    setPrinting('');
  };

  const handleGenerate = async () => {
    if (!from || !to) {
      toast.error('Elige la fecha de inicio y la de fin del período');
      return;
    }
    if (from > to) {
      toast.error('La fecha de inicio no puede ser posterior a la fecha de fin');
      return;
    }

    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('generatePeriodDispatchGuides', { from, to });
      const data = res?.data || res || {};
      if (data.error) throw new Error(data.error);

      const payload = { ...data, from, to };
      setResult(payload);

      if (data.empty) {
        toast.warning(
          data.no_units
            ? 'Las facturas pagadas del período todavía no tienen bultos vinculados'
            : 'No hay facturas pagadas en ese período'
        );
        return;
      }

      toast.success(
        data.created > 0
          ? `${data.created} guía(s) generada(s) y guardadas en el historial`
          : 'Las guías de ese período ya estaban en el historial'
      );

      if (data.created > 0) await handlePdf(payload, 'save');
      onGenerated?.();
    } catch (_) {
      toast.error('No se pudieron generar las guías del período');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-2xl bg-primary/10 p-2 text-primary">
            <FileStack className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-foreground">Guías del período pagado</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Genera la guía de cada cliente con facturas pagadas en el rango (misma carga de la Orden de
              Despacho del período). Cada guía se guarda numerada en el historial y todas salen en un solo PDF,
              una guía por página.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-slate-500">Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={running} />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-slate-500">Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={running} />
          </div>
          <Button onClick={handleGenerate} disabled={running} className="gap-2 sm:w-auto">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileStack className="h-4 w-4" />}
            {running ? 'Generando guías…' : 'Generar guías del período'}
          </Button>
        </div>

        <PeriodGuidesSummary result={result} onPdf={(mode) => handlePdf(result, mode)} printing={printing} />
      </CardContent>
    </Card>
  );
}