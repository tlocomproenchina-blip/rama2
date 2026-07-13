import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Gauge } from 'lucide-react';

const DAILY_LIMIT = 300;

export default function DailyEmailQuotaCard() {
  const [used, setUsed] = useState(null);

  useEffect(() => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    base44.entities.EmailLog.filter({ sent_date: { $gte: since } }, '-sent_date', DAILY_LIMIT + 50)
      .then((rows) => {
        const count = (rows || []).filter((l) =>
          ['sent', 'delivered', 'opened', 'clicked'].includes(l.status)
        ).length;
        setUsed(count);
      })
      .catch(() => setUsed(0));
  }, []);

  const remaining = used === null ? null : Math.max(DAILY_LIMIT - used, 0);
  const pct = used === null ? 0 : Math.min((used / DAILY_LIMIT) * 100, 100);
  const color = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-medium text-slate-700">Capacidad diaria de emails</p>
          </div>
          <p className="text-sm font-semibold text-slate-800">
            {used === null ? '...' : `${used} / ${DAILY_LIMIT}`}
          </p>
        </div>
        <Progress value={pct} className="h-2" />
        <p className={`text-xs mt-2 ${color}`}>
          {used === null
            ? 'Calculando...'
            : remaining > 0
              ? `Quedan ${remaining} emails disponibles en las últimas 24 horas.`
              : 'Límite diario alcanzado. La capacidad se libera a medida que pasan 24 horas de cada envío.'}
        </p>
      </CardContent>
    </Card>
  );
}