import React, { useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Loader2 } from 'lucide-react';
import useDispatchGuideHistory from '@/hooks/useDispatchGuideHistory';
import DispatchGuideHistoryFilters from './DispatchGuideHistoryFilters';
import DispatchGuideHistoryCard from './DispatchGuideHistoryCard';

// Historial de guías emitidas: filtros y paginación resueltos en el servidor,
// con reimpresión y anotación de entrega por guía.
export default function DispatchGuideHistoryPanel({ highlightId = '', onGuideUpdated }) {
  const [appName, setAppName] = useState('TLEC CARGO');
  const { guides, loading, loadingMore, hasMore, error, filters, setFilters, refresh, loadMore } =
    useDispatchGuideHistory({ enabled: true });

  useEffect(() => {
    base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1)
      .then((rows) => {
        if (rows?.[0]?.app_name) setAppName(rows[0].app_name);
      })
      .catch(() => {});
  }, []);

  const handleUpdated = () => {
    refresh();
    onGuideUpdated?.();
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <DispatchGuideHistoryFilters filters={filters} onChange={setFilters} onRefresh={refresh} loading={loading} />

        {error && (
          <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">{error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : guides.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <ClipboardList className="mx-auto mb-2 h-10 w-10" />
            <p className="text-sm">Todavía no hay guías de despacho emitidas con estos filtros.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {guides.map((guide) => (
              <DispatchGuideHistoryCard
                key={guide.id}
                guide={guide}
                appName={appName}
                highlighted={guide.id === highlightId}
                onGuideUpdated={handleUpdated}
              />
            ))}
            {hasMore && (
              <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Cargar más guías
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}