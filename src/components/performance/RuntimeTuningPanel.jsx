import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gauge, Loader2, RefreshCw, SlidersHorizontal, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function RuntimeTuningPanel() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [tuning, setTuning] = useState(null);
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tuningRows, metricsRows] = await Promise.all([
        base44.entities.RuntimeTuning.filter({ config_key: 'global' }, '-updated_date', 1),
        base44.entities.RuntimeMetrics.list('-created_date', 50)
      ]);
      setTuning((tuningRows || [])[0] || null);
      setMetrics(metricsRows || []);
    } catch (_) {
      toast.error('No se pudo cargar el tuning');
    } finally {
      setLoading(false);
    }
  };

  const metricsSummary = useMemo(() => {
    const recent = (metrics || []).filter((item) => Date.now() - new Date(item.created_date).getTime() <= 5 * 60 * 1000);
    const queues = recent.map((item) => Number(item.queue_length) || 0);
    const fails = recent.map((item) => Number(item.failure_count) || 0);
    return {
      samples: recent.length,
      avgQueue: recent.length ? (queues.reduce((sum, value) => sum + value, 0) / recent.length).toFixed(1) : '0.0',
      maxQueue: recent.length ? Math.max(...queues) : 0,
      avgFails: recent.length ? (fails.reduce((sum, value) => sum + value, 0) / recent.length).toFixed(1) : '0.0'
    };
  }, [metrics]);

  const runOptimization = async () => {
    try {
      setRunning(true);
      await base44.functions.invoke('computeRuntimeTuning', {});
      toast.success('Tuning recalculado');
      loadData();
    } catch (_) {
      toast.error('No se pudo recalcular el tuning');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" />Autoajuste</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Cargando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" />Autoajuste de rendimiento</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Actualizar</Button>
            <Button size="sm" onClick={runOptimization} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}Optimizar ahora
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-slate-100 text-slate-800">Motivo: {tuning?.reason || 'sin datos'}</Badge>
          <Badge className="bg-slate-100 text-slate-800">Modo UI: {tuning?.ui_degradation_mode || 'off'}</Badge>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Max reads" value={tuning?.max_reads ?? '—'} />
          <Metric label="Max writes" value={tuning?.max_writes ?? '—'} />
          <Metric label="Min interval" value={tuning?.min_interval_ms ? `${tuning.min_interval_ms} ms` : '—'} />
          <Metric label="Breaker" value={tuning?.circuit_breaker_threshold ?? '—'} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Muestras 5 min" value={metricsSummary.samples} />
          <Metric label="Cola promedio" value={metricsSummary.avgQueue} />
          <Metric label="Cola máxima" value={metricsSummary.maxQueue} />
          <Metric label="Fallos promedio" value={metricsSummary.avgFails} />
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Gauge className="h-4 w-4" />Última actualización: {tuning?.updated_date ? new Date(tuning.updated_date).toLocaleString() : '—'}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-800">{value}</p>
    </div>
  );
}