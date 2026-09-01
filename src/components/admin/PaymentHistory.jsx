import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, CheckCircle, XCircle, Eye, DollarSign, Calendar, User, Loader2, Wallet, Search, Clock, ChevronDown, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import useFileViewer from '@/hooks/useFileViewer';

const METHOD_LABELS = {
  transferencia: 'Transferencia',
  usdt_trc20: 'USDT TRC20',
  binance: 'Binance',
  paypal: 'PayPal',
  wally: 'Wally',
  zinli: 'Zinli',
  wise: 'Wise',
  skrill: 'Skrill',
  pago_movil_usdt: 'Pago Móvil → USDT',
  stripe: 'Stripe',
  otro: 'Otro'
};

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 border-amber-300', borderLeft: 'border-l-amber-500', icon: Clock },
  aprobado: { label: 'Aprobado', className: 'bg-emerald-100 text-emerald-700 border-emerald-300', borderLeft: 'border-l-emerald-500', icon: CheckCircle },
  rechazado: { label: 'Rechazado', className: 'bg-rose-100 text-rose-700 border-rose-300', borderLeft: 'border-l-rose-500', icon: XCircle },
};

const PAGE_SIZE = 50;

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState({});
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [subFilter, setSubFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const fileViewer = useFileViewer();
  const loadedEmailsRef = useRef(new Set());

  const fetchPage = useCallback(async (skip, append) => {
    const data = await base44.entities.InvoicePayment.list('-created_date', PAGE_SIZE + 1, skip);
    const list = data || [];
    const more = list.length > PAGE_SIZE;
    const page = more ? list.slice(0, PAGE_SIZE) : list;
    setHasMore(more);
    return page;
  }, []);

  const loadRelated = useCallback(async (list) => {
    const invIds = Array.from(new Set(list.map((p) => p.invoice_id).filter(Boolean)));
    if (invIds.length) {
      const invs = await base44.entities.Invoice.filter({ id: { $in: invIds } }, '-invoice_date', invIds.length);
      const map = {};
      (invs || []).forEach((inv) => { map[inv.id] = inv; });
      setInvoices((prev) => ({ ...prev, ...map }));
    }

    const emails = Array.from(new Set(list.map((p) => p.client_email).filter(Boolean)));
    const newEmails = emails.filter((e) => !loadedEmailsRef.current.has(e));
    if (newEmails.length) {
      newEmails.forEach((e) => loadedEmailsRef.current.add(e));
      const res = await base44.functions.invoke('getClientsByEmails', { emails: newEmails }).catch(() => null);
      const cmap = {};
      Object.values(res?.data?.clients || {}).forEach((c) => { cmap[c.email] = c; });
      setClients((prev) => ({ ...prev, ...cmap }));
    }
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchPage(0, false);
      setPayments(page);
      await loadRelated(page);
    } catch (e) {
      console.error('Error loading payment history:', e);
    } finally {
      setLoading(false);
    }
  }, [fetchPage, loadRelated]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await base44.functions.invoke('backfillInvoicePayments', {});
      const data = res?.data || {};
      if (data.created > 0) {
        toast.success(`Sincronizado: ${data.created} abono(s) creado(s) de ${data.checked} factura(s) revisada(s)`);
        await loadInitial();
      } else {
        toast.info(`Todo sincronizado — ${data.checked || 0} factura(s) revisada(s), ninguna faltante`);
      }
    } catch {
      toast.error('Error al sincronizar abonos');
    }
    setBackfilling(false);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchPage(payments.length, true);
      setPayments((prev) => [...prev, ...page]);
      await loadRelated(page);
    } catch (e) {
      console.error('Error loading more:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = payments.filter((p) => {
    if (subFilter !== 'all' && p.status !== subFilter) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const client = clients[p.client_email] || {};
    const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim().toLowerCase();
    return (
      clientName.includes(term) ||
      (p.client_email || '').toLowerCase().includes(term) ||
      (p.invoice_number || '').toLowerCase().includes(term) ||
      (p.reference || '').toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
          <Wallet className="h-4 w-4" /> Historial de abonos
          <Badge variant="secondary" className="ml-1">{payments.length}{hasMore ? '+' : ''}</Badge>
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar cliente, factura, ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 sm:w-56"
            />
          </div>
          <Tabs value={subFilter} onValueChange={setSubFilter}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
              <TabsTrigger value="pendiente" className="text-xs">Pendientes</TabsTrigger>
              <TabsTrigger value="aprobado" className="text-xs">Aprobados</TabsTrigger>
              <TabsTrigger value="rechazado" className="text-xs">Rechazados</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={handleBackfill} disabled={backfilling} className="h-9 gap-1.5 whitespace-nowrap">
            {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Wallet className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No hay abonos que coincidan con el filtro</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {filtered.map((p) => {
              const inv = invoices[p.invoice_id] || {};
              const client = clients[p.client_email] || {};
              const total = Number(inv.total || 0);
              const paidAmount = Number(inv.paid_amount || 0);
              const balance = Math.max(0, total - paidAmount);
              const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim() || client.full_name || p.client_email;
              const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pendiente;
              const StatusIcon = cfg.icon;
              const resolutionDate = p.status === 'aprobado' ? p.approved_date : (p.status === 'rechazado' ? p.rejected_date : null);

              return (
                <Card key={p.id} className={`border-0 shadow-md hover:shadow-lg transition-shadow border-l-4 ${cfg.borderLeft}`}>
                  <CardContent className="p-5">
                    <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                          <User className="w-4 h-4" /> Cliente
                        </div>
                        <div className="font-medium text-slate-800 text-sm leading-tight truncate">{clientName}</div>
                        {client.shipping_mark && (
                          <div className="text-xs text-slate-500 truncate">Mark: {client.shipping_mark}</div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                          <FileText className="w-4 h-4" /> Factura
                        </div>
                        <div className="font-medium font-mono text-slate-800 text-sm truncate">{p.invoice_number || inv.invoice_number || 'N/A'}</div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                          <DollarSign className="w-4 h-4" /> Abono
                        </div>
                        <div className="font-bold text-emerald-600">${Number(p.amount || 0).toFixed(2)}</div>
                        {total > 0 && (
                          <div className="text-xs text-amber-600">Saldo: ${balance.toFixed(2)} / ${total.toFixed(2)}</div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                          <Calendar className="w-4 h-4" /> Reportado
                        </div>
                        <div className="font-medium text-slate-800 text-sm">
                          {p.created_date ? format(new Date(p.created_date), 'dd/MM/yyyy HH:mm') : '—'}
                        </div>
                        {resolutionDate && (
                          <div className="text-xs text-slate-500">
                            {p.status === 'aprobado' ? 'Aprobado' : 'Rechazado'}: {format(new Date(resolutionDate), 'dd/MM/yyyy HH:mm')}
                          </div>
                        )}
                      </div>

                      <div className="flex items-start justify-start lg:justify-end">
                        <Badge variant="outline" className={`${cfg.className} gap-1`}>
                          <StatusIcon className="w-3 h-3" /> {cfg.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge variant="outline" className="capitalize">
                        {METHOD_LABELS[p.method] || p.method || '—'}
                      </Badge>
                      {p.reference && (
                        <span className="text-xs text-slate-500 truncate">Ref: {p.reference}</span>
                      )}
                      {p.reject_reason && (
                        <span className="text-xs text-rose-500 truncate">Motivo: {p.reject_reason}</span>
                      )}
                      {p.approved_by && (
                        <span className="text-xs text-slate-400">Por: {p.approved_by}</span>
                      )}
                    </div>

                    {p.proof_url && (
                      <Button variant="outline" size="sm" onClick={() => fileViewer.open(p.proof_url, 'Comprobante de Abono')}>
                        <Eye className="w-4 h-4 mr-1" /> Ver Comprobante
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                Cargar más
              </Button>
            </div>
          )}
        </>
      )}

      {fileViewer.modal}
    </div>
  );
}