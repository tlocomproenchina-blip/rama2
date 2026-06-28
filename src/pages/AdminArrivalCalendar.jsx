import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Loader2, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';
import ArrivalCalendar from '@/components/admin/arrivals/ArrivalCalendar';
import ArrivalDayPanel from '@/components/admin/arrivals/ArrivalDayPanel';

function monthBounds(month) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
}

// Normaliza fecha_estimada_llegada (date o date-time) a clave YYYY-MM-DD
function arrivalKey(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

export default function AdminArrivalCalendar({ user }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState(null);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = monthBounds(month);
      const rows = await base44.entities.CbmIngreso.filter({
        fecha_estimada_llegada: { $gte: start, $lte: end },
      }, '-fecha_estimada_llegada', 1000);
      setLoads(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error('Error loading arrivals:', e);
      toast.error('Error al cargar las fechas de llegada');
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  // Agrupa CBM y conteo por día
  const dayData = useMemo(() => {
    const map = {};
    loads.forEach((l) => {
      const key = arrivalKey(l.fecha_estimada_llegada);
      if (!key) return;
      if (!map[key]) map[key] = { cbm: 0, count: 0 };
      map[key].cbm += Number(l.cbm) || 0;
      map[key].count += 1;
    });
    return map;
  }, [loads]);

  const selectedLoads = useMemo(() => {
    if (!selectedKey) return [];
    return loads.filter((l) => arrivalKey(l.fecha_estimada_llegada) === selectedKey);
  }, [loads, selectedKey]);

  const monthTotals = useMemo(() => {
    const cbm = loads.reduce((s, l) => s + (Number(l.cbm) || 0), 0);
    return { cbm, count: loads.length };
  }, [loads]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
          <CalendarRange className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Calendario de Llegadas</h1>
          <p className="text-slate-500">Identifica qué carga se acumula en cada día del mes según su llegada estimada</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="rounded-xl border bg-white px-4 py-2 shadow-card">
          <p className="text-xs text-slate-500">Cargas en el mes</p>
          <p className="text-xl font-bold text-slate-800">{monthTotals.count}</p>
        </div>
        <div className="rounded-xl border bg-white px-4 py-2 shadow-card">
          <p className="text-xs text-slate-500">CBM total del mes</p>
          <p className="text-xl font-bold text-sky-700">{monthTotals.cbm.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          <ArrivalCalendar
            month={month}
            onMonthChange={(m) => { setMonth(m); setSelectedKey(null); }}
            dayData={dayData}
            selectedKey={selectedKey}
            onSelectDay={setSelectedKey}
          />
        </div>
        <ArrivalDayPanel selectedKey={selectedKey} loads={selectedLoads} />
      </div>
    </div>
  );
}