import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CalendarDays } from 'lucide-react';

export default function CbmMonthlySummary({ currentMonth }) {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    loadHistory();
  }, [currentMonth]);

  const loadHistory = async () => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      return format(d, 'yyyy-MM');
    });

    const all = await base44.entities.CbmIngreso.list('-fecha', 500);
    const grouped = {};
    months.forEach(m => { grouped[m] = 0; });
    (all || []).forEach(item => {
      if (grouped[item.mes] !== undefined) {
        grouped[item.mes] += Number(item.cbm || 0);
      }
    });

    setChartData(months.map(m => {
      const [y, mo] = m.split('-').map(Number);
      return {
        mes: format(new Date(y, mo - 1, 1), 'MMM', { locale: es }),
        cbm: parseFloat(grouped[m].toFixed(3)),
        isCurrent: m === currentMonth
      };
    }));
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-slate-700">CBM últimos 6 meses</p>
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={chartData}>
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis hide />
            <Tooltip formatter={(v) => [`${v} CBM`, 'Total']} />
            <Bar dataKey="cbm" fill="hsl(212, 78%, 64%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}