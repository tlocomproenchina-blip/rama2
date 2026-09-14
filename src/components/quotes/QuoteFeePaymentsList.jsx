import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ExternalLink, Check, Clock } from 'lucide-react';

const STATUS_BADGES = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700', icon: Clock },
  pagado: { label: 'Pagado', color: 'bg-green-100 text-green-700', icon: Check },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-700', icon: Clock },
};

const METHOD_LABELS = {
  stripe: 'Tarjeta',
  paypal: 'PayPal',
  binance: 'Binance',
  usdt_trc20: 'USDT',
  transferencia: 'Transferencia',
  wally: 'Wally',
  zinli: 'Zinli',
  wise: 'Wise',
  skrill: 'Skrill',
  pago_movil_usdt: 'Pago Móvil USDT',
  zelle: 'Zelle',
  otro: 'Otro',
};

export default function QuoteFeePaymentsList({ onOpenQuote }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const list = await base44.entities.QuoteFeePayment.list('-created_date', 200);
      setPayments(list);
    } catch (err) {
      console.error('Error loading payments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = base44.entities.QuoteFeePayment.subscribe(() => load());
    return () => { if (unsub) unsub(); };
  }, [load]);

  const filtered = payments.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    const name = `${p.client_first_name || ''} ${p.client_last_name || ''}`.toLowerCase();
    return (
      name.includes(term) ||
      (p.client_email || '').toLowerCase().includes(term) ||
      (p.generated_quote_number || '').toLowerCase().includes(term) ||
      (p.payment_reference || '').toLowerCase().includes(term)
    );
  });

  const counts = {
    all: payments.length,
    pendiente: payments.filter((p) => p.status === 'pendiente').length,
    pagado: payments.filter((p) => p.status === 'pagado').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, referencia..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-1">
          {[
            { key: 'all', label: `Todos (${counts.all})` },
            { key: 'pendiente', label: `Pendientes (${counts.pendiente})` },
            { key: 'pagado', label: `Pagados (${counts.pagado})` },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                filter === f.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400">
          No hay pagos de tarifa de presupuesto.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const st = STATUS_BADGES[p.status] || STATUS_BADGES.pendiente;
            const StatusIcon = st.icon;
            const clientName = `${p.client_first_name || ''} ${p.client_last_name || ''}`.trim() || 'Sin nombre';
            return (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:border-purple-300 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                      <StatusIcon className="h-3 w-3" /> {st.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(p.created_date).toLocaleDateString()}
                    </span>
                    <span className="text-xs font-medium text-gray-500">
                      {METHOD_LABELS[p.method] || p.method}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-800">{clientName}</p>
                  <p className="text-xs text-gray-500 truncate">{p.client_email}</p>
                  {p.generated_quote_number && (
                    <p className="text-xs text-purple-600 font-medium mt-0.5">
                      Presupuesto: {p.generated_quote_number}
                    </p>
                  )}
                  {p.payment_reference && (
                    <p className="text-xs text-gray-400 mt-0.5">Ref: {p.payment_reference}</p>
                  )}
                </div>
                <div className="ml-4 text-right shrink-0">
                  <p className="text-sm font-bold text-gray-800">${(p.amount || 0).toFixed(2)}</p>
                  {p.status === 'pagado' && p.generated_quote_token && (
                    <button
                      onClick={() => onOpenQuote?.(p.generated_quote_token)}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-purple-600 hover:underline"
                    >
                      Ver presupuesto <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}