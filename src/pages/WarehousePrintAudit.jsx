import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import usePrintAuditLogs from '@/hooks/usePrintAuditLogs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Printer, ShieldCheck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import useCedulaClientEmails from '@/hooks/useCedulaClientEmails';

const TYPE_LABELS = {
  primera: 'Primera impresión',
  reimpresion: 'Reimpresión',
  solicitud_reimpresion: 'Solicitud de aprobación',
  reimpresion_aprobada: 'Reimpresión aprobada'
};

const STATUS_STYLES = {
  pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
  aprobado: 'bg-green-100 text-green-700 border-green-200',
  rechazado: 'bg-red-100 text-red-700 border-red-200',
  'n/a': 'bg-slate-100 text-slate-500 border-slate-200'
};

export default function WarehousePrintAudit() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Cédula escrita en el buscador → correos de los clientes que la tienen.
  const cedulaEmails = useCedulaClientEmails(search);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { logs, total, loading, loadingMore, hasMore, loadMore } = usePrintAuditLogs({
    search: debouncedSearch, typeFilter, statusFilter, cedulaEmails
  });

  const load = () => {
    queryClient.invalidateQueries({ queryKey: ['printAuditLogs'] });
    queryClient.invalidateQueries({ queryKey: ['printAuditCount'] });
  };

  const handleApprove = async (logId) => {
    setActionLoading(logId);
    try {
      const res = await base44.functions.invoke('approveBultoReprint', { print_log_id: logId });
      if (res?.data?.error) {
        toast.error(res.data.error);
      } else {
        toast.success('Reimpresión aprobada');
        load();
      }
    } catch (_) {
      toast.error('Error al aprobar');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Printer className="h-6 w-6 text-blue-600" /> Auditoría de Impresiones
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Registro de todas las impresiones de etiquetas de bultos. Aprueba solicitudes de reimpresión pendientes aquí.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por etiqueta, cliente, usuario o motivo…"
                className="pl-10"
              />
            </div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">Todos los tipos</option>
              <option value="primera">Primera impresión</option>
              <option value="reimpresion">Reimpresión</option>
              <option value="solicitud_reimpresion">Solicitud de aprobación</option>
              <option value="reimpresion_aprobada">Reimpresión aprobada</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="aprobado">Aprobados</option>
              <option value="rechazado">Rechazados</option>
              <option value="n/a">N/A</option>
            </select>
          </div>
          <p className="text-xs text-slate-500">{total} registro(s) encontrado(s)</p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
      ) : logs.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-slate-500">
          <Printer className="h-10 w-10 mx-auto mb-2 text-slate-300" />
          No hay registros de impresión que coincidan.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <Card key={l.id} className="shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-slate-500 bg-muted px-1.5 py-0.5 rounded">{l.label_code || '—'}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {TYPE_LABELS[l.print_type] || l.print_type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_STYLES[l.approval_status] || STATUS_STYLES['n/a']}`}>
                        {l.approval_status === 'pendiente' && <Clock className="h-3 w-3 inline mr-1" />}
                        {l.approval_status === 'aprobado' && <CheckCircle2 className="h-3 w-3 inline mr-1" />}
                        {l.approval_status === 'rechazado' && <XCircle className="h-3 w-3 inline mr-1" />}
                        {l.approval_status || 'n/a'}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      <span className="font-medium">{l.client_email || '—'}</span>
                      <span className="text-slate-400"> · {l.printed_by || '—'}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                      <span>{l.print_date ? new Date(l.print_date).toLocaleString('es-VE') : ''}</span>
                      {l.reason && <span>Motivo: {l.reason}{l.reason === 'Otra' && l.reason_detail ? ` — ${l.reason_detail}` : ''}</span>}
                      {l.approved_by && <span className="text-green-600">Aprobado por: {l.approved_by}</span>}
                    </div>
                  </div>
                  {l.approval_status === 'pendiente' && (
                    <Button
                      size="sm"
                      onClick={() => handleApprove(l.id)}
                      disabled={actionLoading === l.id}
                      className="shrink-0 bg-green-600 hover:bg-green-700"
                    >
                      {actionLoading === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      Aprobar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && hasMore && (
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-slate-600">Mostrando {logs.length} de {total}</span>
          <Button variant="outline" size="sm" onClick={() => loadMore()} disabled={loadingMore}>
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Cargar más
          </Button>
        </div>
      )}
    </div>
  );
}