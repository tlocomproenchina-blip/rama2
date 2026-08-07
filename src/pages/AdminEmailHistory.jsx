import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, Mail, RefreshCw, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import PageHero from '@/components/common/PageHero';
import EmailLogCard from '@/components/communications/EmailLogCard';
import EmailQueuePendingPanel from '@/components/communications/EmailQueuePendingPanel';
import DailyEmailQuotaCard from '@/components/communications/DailyEmailQuotaCard';
import BrevoQuotaCard from '@/components/communications/BrevoQuotaCard';

export default function AdminEmailHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  const loadLogs = async () => {
    setLoading(true);
    try {
      // FASE 1: primeros 50 al instante (los emails guardan el cuerpo completo,
      // pedir 300 de golpe hacía la carga muy lenta)
      const first = await base44.entities.EmailLog.list('-sent_date', 50);
      setLogs(first || []);
      setLoading(false);

      // FASE 2: el resto en segundo plano
      if ((first || []).length === 50) {
        const rest = await base44.entities.EmailLog.list('-sent_date', 250, 50).catch(() => []);
        if (rest && rest.length) setLogs([...(first || []), ...rest]);
      }
    } catch (_) {
      setLogs([]);
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const filtered = useMemo(() => {
    let list = logs;
    if (statusFilter !== 'all') list = list.filter(l => l.status === statusFilter);
    if (sourceFilter !== 'all') list = list.filter(l => (l.source || 'manual') === sourceFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        (l.recipient_email || '').toLowerCase().includes(q) ||
        (l.recipient_name || '').toLowerCase().includes(q) ||
        (l.subject || '').toLowerCase().includes(q) ||
        (l.body_preview || '').toLowerCase().includes(q) ||
        (l.campaign_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, search, statusFilter, sourceFilter]);

  const stats = useMemo(() => ({
    total: logs.length,
    sent: logs.filter(l => ['sent', 'delivered', 'opened', 'clicked'].includes(l.status)).length,
    failed: logs.filter(l => l.status === 'failed' || l.status === 'bounced').length,
  }), [logs]);

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <PageHero
        icon={Mail}
        title="Historial de Emails"
        subtitle="Registro de los correos enviados a los clientes, con su asunto y contenido."
      />

      <DailyEmailQuotaCard />

      <BrevoQuotaCard />

      <EmailQueuePendingPanel />

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-slate-500">Total registrados</p>
          <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-slate-500">Enviados</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.sent}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-slate-500">Fallidos / rebotados</p>
          <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente, asunto o contenido..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="failed">Fallidos</SelectItem>
                <SelectItem value="bounced">Rebotados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los orígenes</SelectItem>
                <SelectItem value="manual">Notificaciones</SelectItem>
                <SelectItem value="campaign">Campañas / resúmenes</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadLogs} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando historial...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Inbox className="h-10 w-10 mx-auto mb-2" />
          <p className="text-sm">No hay emails que coincidan con el filtro.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <EmailLogCard key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}