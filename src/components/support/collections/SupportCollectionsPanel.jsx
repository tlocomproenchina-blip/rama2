import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, DollarSign, Loader2, RefreshCw, Search, Users } from 'lucide-react';
import { fetchAllPaginated } from '@/lib/fetchAllPaginated';
import { invoiceAging, invoiceBalance, invoiceClientName, OVERDUE_DAYS, PENDING_STATUSES } from '@/lib/collections';
import CollectionsInvoiceCard from './CollectionsInvoiceCard';

const FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'vencidas', label: 'Vencidas' },
  { key: 'por_vencer', label: 'Por vencer' },
];

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

// Módulo de cobranza de Soporte: facturas pendientes con sus días vencidos y el
// botón para notificar el pago por email o WhatsApp.
export default function SupportCollectionsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todas');

  const loadData = async () => {
    setLoading(true);
    try {
      const invoices = await fetchAllPaginated('Invoice', {
        method: 'filter',
        query: { status: { $in: PENDING_STATUSES } },
        sort: '-invoice_date',
      });

      const now = Date.now();
      let list = invoices
        .map((invoice) => {
          const aging = invoiceAging(invoice, now);
          return {
            invoice,
            aging,
            balance: invoiceBalance(invoice),
            name: invoiceClientName(invoice),
          };
        })
        .filter((row) => row.balance > 0.009)
        .sort((a, b) => b.aging.daysOverdue - a.aging.daysOverdue
          || new Date(a.invoice.invoice_date || 0) - new Date(b.invoice.invoice_date || 0));

      const missingWhatsapp = Array.from(new Set(
        list.filter((row) => !row.invoice.client_whatsapp && row.invoice.client_email).map((row) => row.invoice.client_email)
      ));

      if (missingWhatsapp.length > 0) {
        const res = await base44.functions
          .invoke('getClientsByEmails', { emails: missingWhatsapp }, { opType: 'read', priority: 'LOW' })
          .catch(() => null);
        const clients = res?.data?.clients || {};
        list = list.map((row) => {
          const client = clients[row.invoice.client_email];
          if (!client) return row;
          const invoice = {
            ...row.invoice,
            client_whatsapp: row.invoice.client_whatsapp || client.whatsapp || '',
            client_first_name: row.invoice.client_first_name || client.first_name || '',
            client_last_name: row.invoice.client_last_name || client.last_name || '',
            shipping_mark: row.invoice.shipping_mark || client.shipping_mark || '',
          };
          return { ...row, invoice, name: invoiceClientName(invoice) };
        });
      }

      setRows(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const overdue = row.aging.daysOverdue > 0;
      const matchesFilter = filter === 'todas' || (filter === 'vencidas' ? overdue : !overdue);
      if (!matchesFilter) return false;
      if (!q) return true;
      const invoice = row.invoice;
      return [
        invoice.invoice_number,
        invoice.client_email,
        invoice.shipping_mark,
        invoice.consolidation_tracking,
        row.name,
      ].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [rows, search, filter]);

  const stats = useMemo(() => {
    const overdue = rows.filter((row) => row.aging.daysOverdue > 0);
    return {
      invoices: rows.length,
      overdue: overdue.length,
      overdueAmount: overdue.reduce((sum, row) => sum + row.balance, 0),
      total: rows.reduce((sum, row) => sum + row.balance, 0),
      clients: new Set(rows.map((row) => row.invoice.client_email).filter(Boolean)).size,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Actualizar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Facturas por cobrar</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{stats.invoices}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Total por cobrar</p>
            <p className="mt-1 flex items-center gap-1 text-2xl font-bold text-slate-800">
              <DollarSign className="h-5 w-5 text-slate-400" />
              {money(stats.total)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Vencidas ({OVERDUE_DAYS}+ días)</p>
            <p className="mt-1 flex items-center gap-1 text-2xl font-bold text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {stats.overdue}
            </p>
            <p className="text-[11px] text-slate-500">{money(stats.overdueAmount)} vencidos</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Clientes con saldo</p>
            <p className="mt-1 flex items-center gap-1 text-2xl font-bold text-slate-800">
              <Users className="h-5 w-5 text-slate-400" />
              {stats.clients}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por factura, cliente, shipping mark o consolidación..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === option.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Una factura se considera vencida a los {OVERDUE_DAYS} días de su emisión y el recordatorio cambia de texto
        según los días vencidos (1-10, 11-29, 30-44 y 45+).
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center">
            <DollarSign className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="font-semibold text-slate-700">No hay facturas por cobrar con estos filtros</p>
            <p className="text-sm text-slate-500">Prueba con otra búsqueda o cambia el filtro.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((row) => (
            <CollectionsInvoiceCard
              key={row.invoice.id}
              invoice={row.invoice}
              aging={row.aging}
            />
          ))}
        </div>
      )}
    </div>
  );
}