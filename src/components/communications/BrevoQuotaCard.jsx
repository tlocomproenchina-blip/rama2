import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Zap, RotateCcw, Gauge } from 'lucide-react';
import { toast } from 'sonner';

export default function BrevoQuotaCard() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [limitInput, setLimitInput] = useState('295');

  const today = new Date().toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      const cfg = configs?.[0] || null;
      setConfig(cfg);
      setLimitInput(String(cfg?.brevo_daily_limit ?? 295));
    } catch (_) {
      setConfig(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sentToday = config?.brevo_counter_date === today ? (config?.brevo_emails_sent_today ?? 0) : 0;
  const limit = config?.brevo_daily_limit ?? 295;
  const remaining = Math.max(0, limit - sentToday);
  const quotaExceeded = sentToday >= limit;
  const pct = limit > 0 ? Math.min(100, Math.round((sentToday / limit) * 100)) : 0;

  const handleReset = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await base44.entities.AppConfig.update(config.id, {
        brevo_emails_sent_today: 0,
        brevo_counter_date: today,
      });
      toast.success('Contador reiniciado a 0');
      await load();
    } catch (_) {
      toast.error('No se pudo reiniciar el contador');
    }
    setSaving(false);
  };

  const handleSaveLimit = async () => {
    if (!config) return;
    const newLimit = parseInt(limitInput, 10);
    if (isNaN(newLimit) || newLimit < 1) {
      toast.error('El límite debe ser un número válido');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.AppConfig.update(config.id, { brevo_daily_limit: newLimit });
      toast.success('Límite diario actualizado');
      await load();
    } catch (_) {
      toast.error('No se pudo guardar el límite');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando contador Brevo...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${quotaExceeded ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {quotaExceeded ? <Zap className="h-5 w-5" /> : <Send className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Plan B — Contador Brevo</h3>
            <p className="text-xs text-slate-500">
              {quotaExceeded
                ? 'Cuota agotada — enviando con función nativa (créditos)'
                : 'Enviando con Brevo — sin consumir créditos'}
            </p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-600">Enviados hoy</span>
            <span className={`font-semibold ${quotaExceeded ? 'text-amber-600' : 'text-slate-800'}`}>
              {sentToday} / {limit}
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${quotaExceeded ? 'bg-amber-500' : pct > 80 ? 'bg-orange-500' : 'bg-emerald-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Restantes: {remaining}</span>
            <span>Fecha: {config?.brevo_counter_date || '—'}</span>
          </div>
        </div>

        {quotaExceeded && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-700">
            <Gauge className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Se alcanzó el límite diario de Brevo. Los emails ahora se envían con la función nativa
              (consume créditos de integración). Al cambiar la fecha o al reiniciar manualmente, volverá a Brevo.
            </span>
          </div>
        )}

        {/* Configuración del límite + reset */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-slate-500">Límite diario</label>
            <Input
              type="number"
              min="1"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              className="h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSaveLimit} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Guardar límite
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Reiniciar contador
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}