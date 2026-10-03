import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, History, Loader2 } from 'lucide-react';
import LabelPrintHistoryCard from './LabelPrintHistoryCard';

const PAGE_SIZE = 10;

// Historial de impresión del cliente: cada lote que salió por la impresora térmica, del
// más reciente al más antiguo, con su botón para reimprimir la etiqueta cuando haga
// falta (se perdió, se dañó, o la impresión quedó cortada).
export default function LabelPrintHistory({ clientEmail, refreshKey = 0, onReprint, reprintingId }) {
  const [logs, setLogs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    if (!clientEmail) {
      setLogs([]);
      setHasMore(false);
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('listLabelPrints', {
        client_email: clientEmail,
        limit,
      });
      const data = res?.data || res || {};
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setHasMore(!!data.has_more);
    } catch (_) {
      setLogs([]);
      setHasMore(false);
    }
    setLoading(false);
  }, [clientEmail, limit]);

  // Al cambiar de cliente se vuelve a la primera página.
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [clientEmail]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!clientEmail) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <History className="h-4 w-4 text-blue-600" />
            Historial de impresión
            {logs.length > 0 && (
              <span className="text-xs font-normal text-slate-500">({logs.length})</span>
            )}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>

        {expanded && (
          <>
            {loading && logs.length === 0 ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-xs text-slate-400">
                Todavía no se han impreso etiquetas para este cliente.
              </p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <LabelPrintHistoryCard
                    key={log.id}
                    log={log}
                    onReprint={onReprint}
                    reprinting={reprintingId === log.id}
                  />
                ))}
                {hasMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={loading}
                    onClick={() => setLimit((value) => value + PAGE_SIZE)}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ver más'}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}