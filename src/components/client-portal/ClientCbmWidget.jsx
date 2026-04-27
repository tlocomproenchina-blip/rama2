import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, CalendarDays, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ClientCbmWidget({ userEmail }) {
  const [ingresos, setIngresos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userEmail) return;
    (async () => {
      try {
        const data = await base44.entities.CbmIngreso.filter(
          { client_email: userEmail },
          '-fecha',
          50
        );
        setIngresos(data || []);
      } catch {
        setIngresos([]);
      }
      setLoading(false);
    })();
  }, [userEmail]);

  const totalCbm = useMemo(
    () => ingresos.reduce((s, i) => s + Number(i.cbm || 0), 0),
    [ingresos]
  );

  const byMonth = useMemo(() => {
    const map = {};
    ingresos.forEach((i) => {
      const key = i.mes || (i.fecha ? format(new Date(i.fecha), 'yyyy-MM') : 'sin-mes');
      if (!map[key]) map[key] = { month: key, cbm: 0, records: [] };
      map[key].cbm += Number(i.cbm || 0);
      map[key].records.push(i);
    });
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
  }, [ingresos]);

  if (loading) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardContent className="p-6 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Cargando CBM...
        </CardContent>
      </Card>
    );
  }

  if (ingresos.length === 0) return null;

  return (
    <Card className="border-border/70 bg-card/95 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Mis CBM Registrados
          </span>
          <Badge className="bg-blue-100 text-blue-700 text-sm font-bold">
            {totalCbm.toFixed(3)} CBM
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {byMonth.map((group) => (
          <div key={group.month} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                {(() => {
                  try {
                    const [y, m] = group.month.split('-');
                    return format(new Date(Number(y), Number(m) - 1, 1), 'MMMM yyyy', { locale: es });
                  } catch {
                    return group.month;
                  }
                })()}
              </span>
              <Badge variant="outline" className="text-xs">
                {group.cbm.toFixed(3)} CBM
              </Badge>
            </div>

            <div className="space-y-1.5">
              {group.records.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-blue-700 text-sm">
                        {Number(item.cbm).toFixed(5)} CBM
                      </span>
                      {item.invoice_number && (
                        <Badge variant="outline" className="text-[10px]">
                          {item.invoice_number}
                        </Badge>
                      )}
                    </div>

                    {item.tracking_numbers && item.tracking_numbers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tracking_numbers.map((t) => (
                          <span
                            key={t}
                            className="inline-block text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.descripcion && (
                      <p className="text-xs text-slate-500 truncate">
                        {item.descripcion}
                      </p>
                    )}

                    <p className="text-[11px] text-muted-foreground">
                      {item.fecha
                        ? format(new Date(item.fecha), 'dd MMM yyyy · HH:mm', { locale: es })
                        : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}