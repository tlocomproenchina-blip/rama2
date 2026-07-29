import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { History, RefreshCw, Loader2 } from 'lucide-react';

export default function RecentDispatchOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.DispatchOrder.list('-created_date', 10);
      setOrders(rows || []);
    } catch (_) {
      setOrders([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-blue-600" /> Últimas 10 órdenes
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Link to="/WarehouseDispatchHistory">
            <Button variant="outline" size="sm">Ver historial</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {orders.length === 0 && !loading && (
          <p className="text-sm text-slate-400">Aún no hay órdenes de despacho registradas.</p>
        )}
        {orders.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold text-slate-800 break-all">{o.order_number || '—'}</p>
              <p className="text-xs text-slate-500 truncate">
                {o.client_name || o.client_email} · {(o.items || []).length} paq.
              </p>
            </div>
            <Badge className={o.status === 'cancelada' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}>
              {o.status === 'cancelada' ? 'Cancelada' : 'Emitida'}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}