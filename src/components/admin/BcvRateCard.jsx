import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Euro, Loader2, RefreshCw, Calendar, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function BcvRateCard({ config }) {
  const [syncing, setSyncing] = useState(false);
  const [localRate, setLocalRate] = useState(config?.bcv_eur_rate || 0);
  const [localDate, setLocalDate] = useState(config?.bcv_eur_rate_date || null);
  const [localSync, setLocalSync] = useState(config?.bcv_eur_rate_last_sync || null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncBcvEurRate', {});
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      if (data.status === 'error') throw new Error(data.message || 'Error al sincronizar');

      setLocalRate(data.rate);
      setLocalDate(data.date);
      setLocalSync(data.last_sync);

      if (data.status === 'unchanged') {
        toast.info(`Tasa sin cambios: ${data.rate} Bs/EUR`);
      } else if (data.changed) {
        toast.success(`Tasa actualizada: ${data.rate} Bs/EUR (antes ${data.previous_rate})`);
      } else {
        toast.success(`Tasa sincronizada: ${data.rate} Bs/EUR`);
      }
    } catch (err) {
      toast.error(err?.message || 'No se pudo sincronizar la tasa BCV');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    try {
      const date = d.includes('T') ? new Date(d) : new Date(d + 'T00:00:00');
      return date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const formatSync = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('es-VE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return d;
    }
  };

  const hasRate = localRate > 0;

  return (
    <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <Euro className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg">Tasa BCV (Euro)</CardTitle>
              <CardDescription>
                Sincronización automática 6 veces al día (4pm–9pm). Se usa para mostrar montos en Bolívares (Bs) al cliente.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <TrendingUp className="h-3.5 w-3.5" />
              Tasa actual
            </div>
            <p className="mt-2 text-2xl font-bold text-blue-700">
              {hasRate ? `${localRate.toFixed(2)}` : '—'}
              {hasRate && <span className="ml-1 text-sm font-medium text-slate-500">Bs/€</span>}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <Calendar className="h-3.5 w-3.5" />
              Fecha BCV
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-700">{formatDate(localDate)}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              <RefreshCw className="h-3.5 w-3.5" />
              Última sync
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-700">{formatSync(localSync)}</p>
          </div>
        </div>

        {!hasRate && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              ⚠️ Aún no hay tasa sincronizada. Presiona <strong>Actualizar ahora</strong> para obtener la tasa actual del BCV, o espera a la próxima sincronización automática.
            </p>
          </div>
        )}

        <Button
          onClick={handleSync}
          disabled={syncing}
          variant="outline"
          className="w-full border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-800"
        >
          {syncing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sincronizando...</>
          ) : (
            <><RefreshCw className="mr-2 h-4 w-4" /> Actualizar ahora</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}