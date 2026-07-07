import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, CalendarDays, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import CbmOrderCard from '@/components/client-portal/CbmOrderCard';
import CbmTrackingSearch from '@/components/client-portal/CbmTrackingSearch';

export default function ClientCbmWidget({ userEmail }) {
  const [ingresos, setIngresos] = useState([]);
  const [paidInvoiceIds, setPaidInvoiceIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userEmail) return;
    (async () => {
      try {
        const [data, paidInvoices] = await Promise.all([
          base44.entities.CbmIngreso.filter({ client_email: userEmail }, '-fecha', 50),
          base44.entities.Invoice.filter({ client_email: userEmail, status: 'pagada' }, '-invoice_date', 100)
        ]);
        setIngresos(data || []);
        setPaidInvoiceIds(new Set((paidInvoices || []).map((inv) => inv.id)));
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

  return (
    <div className="space-y-4">
    <CbmTrackingSearch userEmail={userEmail} ingresos={ingresos} />
    {ingresos.length > 0 && (
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
        {/* Aviso de pre-cálculo */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-800">Pre cálculo de su carga</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                En pro de mejorar nuestros servicios, realizamos la revisión de toda la carga una vez llegue a Venezuela.
              </p>
              <p className="text-xs font-semibold text-red-600 leading-relaxed">
                El total del espacio ocupado (CBM) y el monto a pagar lo podrá ver una vez sea emitida la orden.
              </p>
            </div>
          </div>
        </div>

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
                {group.records.length} {group.records.length === 1 ? 'orden' : 'órdenes'}
              </Badge>
            </div>

            <div className="space-y-2">
              {group.records.map((item) => (
                <CbmOrderCard
                  key={item.id}
                  item={item}
                  paid={!!(item.billed_invoice_id && paidInvoiceIds.has(item.billed_invoice_id))}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
    )}
    </div>
  );
}