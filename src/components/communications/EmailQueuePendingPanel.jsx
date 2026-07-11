import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Send } from 'lucide-react';
import { format } from 'date-fns';

const CYCLE_MS = 15 * 60 * 1000; // la cola se procesa cada 15 minutos

function remainingLabel(item, now) {
  const queuedAt = new Date(item.scheduled_at || item.created_date).getTime();
  const remaining = queuedAt + CYCLE_MS - now;
  if (remaining <= 0) return 'Enviándose en el próximo ciclo…';
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return `Sale en ~${mins}:${String(secs).padStart(2, '0')} min`;
}

export default function EmailQueuePendingPanel() {
  const [pending, setPending] = useState([]);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    try {
      const rows = await base44.entities.EmailQueue.filter({ status: 'pending' }, '-created_date', 50);
      setPending(rows || []);
    } catch (_) {
      setPending([]);
    }
  };

  useEffect(() => {
    load();
    const refresh = setInterval(load, 60000); // re-consultar la cola cada minuto
    const tick = setInterval(() => setNow(Date.now()), 1000); // cuenta atrás en vivo
    return () => { clearInterval(refresh); clearInterval(tick); };
  }, []);

  if (pending.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-semibold text-amber-900">En tránsito de salida ({pending.length})</p>
        </div>
        <div className="space-y-2">
          {pending.map((item) => (
            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-lg border border-amber-200 bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{item.subject}</p>
                <p className="text-xs text-slate-500 break-all">Para: {item.recipient_email}</p>
                <p className="text-[11px] text-slate-400">
                  Encolado: {format(new Date(item.scheduled_at || item.created_date), 'dd MMM yyyy · hh:mm a')}
                </p>
              </div>
              <Badge className="w-fit shrink-0 gap-1 bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                <Clock className="h-3 w-3" />
                {remainingLabel(item, now)}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}