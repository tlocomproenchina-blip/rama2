import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Send, Zap, TrendingUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function BrevoDailyLogTable() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.BrevoDailyLog.list('-log_date', 60);
      setLogs(data || []);
    } catch (_) {
      setLogs([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const totalBrevo = logs.reduce((s, l) => s + (l.brevo_sent || 0), 0);
    const totalNative = logs.reduce((s, l) => s + (l.native_sent || 0), 0);
    const daysExceeded = logs.filter(l => l.quota_exceeded).length;
    const daysWithNative = logs.filter(l => (l.native_sent || 0) > 0).length;
    return { totalBrevo, totalNative, daysExceeded, daysWithNative, totalDays: logs.length };
  }, [logs]);

  const handleDelete = async (id) => {
    try {
      await base44.entities.BrevoDailyLog.delete(id);
      setLogs(prev => prev.filter(l => l.id !== id));
      toast.success('Registro eliminado');
    } catch (_) {
      toast.error('No se pudo eliminar');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Historial diario de envíos</h3>
              <p className="text-xs text-slate-500">Evalúa cuándo necesitas mejorar tu plan de Brevo</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <Loader2 className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2.5">
            <p className="text-xs text-emerald-600">Vía Brevo</p>
            <p className="text-lg font-bold text-emerald-700">{stats.totalBrevo}</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5">
            <p className="text-xs text-amber-600">Vía nativo</p>
            <p className="text-lg font-bold text-amber-700">{stats.totalNative}</p>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5">
            <p className="text-xs text-blue-600">Días registrados</p>
            <p className="text-lg font-bold text-blue-700">{stats.totalDays}</p>
          </div>
          <div className="rounded-lg bg-rose-50 border border-rose-100 p-2.5">
            <p className="text-xs text-rose-600">Días con cuota agotada</p>
            <p className="text-lg font-bold text-rose-700">{stats.daysExceeded}</p>
          </div>
        </div>

        {stats.daysExceeded > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
            <TrendingUp className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Has agotado la cuota de Brevo en <strong>{stats.daysExceeded}</strong> día(s).
              Considera mejorar tu plan de Brevo para evitar consumir créditos de integración.
            </span>
          </div>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando historial...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            Aún no hay registros. Se crearán automáticamente al enviar emails.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 font-medium text-center">Brevo</th>
                  <th className="pb-2 font-medium text-center">Nativo</th>
                  <th className="pb-2 font-medium text-center">Total</th>
                  <th className="pb-2 font-medium text-center">Límite</th>
                  <th className="pb-2 font-medium text-center">Estado</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const total = (log.brevo_sent || 0) + (log.native_sent || 0);
                  return (
                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2 text-slate-700">{formatDate(log.log_date)}</td>
                      <td className="py-2 text-center">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <Send className="h-3 w-3" />{log.brevo_sent || 0}
                        </span>
                      </td>
                      <td className="py-2 text-center">
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                          <Zap className="h-3 w-3" />{log.native_sent || 0}
                        </span>
                      </td>
                      <td className="py-2 text-center font-semibold text-slate-700">{total}</td>
                      <td className="py-2 text-center text-slate-400 text-xs">{log.brevo_limit || 295}</td>
                      <td className="py-2 text-center">
                        {log.quota_exceeded ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-xs font-medium">
                            Cuota agotada
                          </span>
                        ) : (log.native_sent || 0) > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 text-xs font-medium">
                            Con fallback
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-medium">
                            Solo Brevo
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-300 hover:text-rose-500"
                          onClick={() => handleDelete(log.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}