import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Intensidad de color según CBM acumulado del día
function heatClass(cbm) {
  if (cbm <= 0) return '';
  if (cbm < 1) return 'bg-sky-50 border-sky-200';
  if (cbm < 3) return 'bg-sky-100 border-sky-300';
  if (cbm < 6) return 'bg-amber-100 border-amber-300';
  return 'bg-rose-100 border-rose-300';
}

export default function ArrivalCalendar({ month, onMonthChange, dayData, selectedKey, onSelectDay }) {
  const { weeks, todayKey } = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const grouped = [];
    for (let i = 0; i < cells.length; i += 7) grouped.push(cells.slice(i, i + 7));
    return { weeks: grouped, todayKey: toKey(new Date()) };
  }, [month]);

  const goPrev = () => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const goNext = () => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  const goToday = () => onMonthChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-lg font-semibold text-slate-800 min-w-[160px] text-center">
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </h2>
          <Button variant="outline" size="icon" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Button variant="ghost" size="sm" onClick={goToday}>Hoy</Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((date, idx) => {
          if (!date) return <div key={`empty-${idx}`} className="aspect-square" />;
          const key = toKey(date);
          const info = dayData[key];
          const cbm = info?.cbm || 0;
          const count = info?.count || 0;
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          return (
            <button
              key={key}
              onClick={() => onSelectDay(key)}
              className={`aspect-square rounded-xl border p-1.5 flex flex-col items-start justify-start text-left transition-all
                ${count > 0 ? heatClass(cbm) : 'bg-slate-50/50 border-slate-100'}
                ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}
                ${count > 0 ? 'hover:shadow-md' : 'hover:bg-slate-100'}`}
            >
              <span className={`text-xs font-semibold ${isToday ? 'bg-primary text-white rounded-full h-5 w-5 flex items-center justify-center' : 'text-slate-600'}`}>
                {date.getDate()}
              </span>
              {count > 0 && (
                <div className="mt-auto w-full">
                  <p className="text-[10px] font-bold text-slate-700 leading-tight">{cbm.toFixed(2)} CBM</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{count} {count === 1 ? 'carga' : 'cargas'}</p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 text-[11px] text-slate-500">
        <span className="font-medium">Acumulado por día:</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-100 border border-sky-300" /> Bajo</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-100 border border-amber-300" /> Medio</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-rose-100 border border-rose-300" /> Alto</span>
      </div>
    </div>
  );
}