import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, RotateCcw, Calendar } from 'lucide-react';

const currentYear = new Date().getFullYear();
const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' }, { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' }, { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

function getQuarterRange() {
  const m = new Date().getMonth(); // 0-based
  const qStart = Math.floor(m / 3) * 3 + 1;
  const qEnd = qStart + 2;
  return {
    start: `${currentYear}-${String(qStart).padStart(2, '0')}`,
    end: `${currentYear}-${String(qEnd).padStart(2, '0')}`,
  };
}

function getLastQuarterRange() {
  const m = new Date().getMonth();
  let qStart = Math.floor(m / 3) * 3 - 2; // previous quarter start (1-based)
  let y = currentYear;
  if (qStart <= 0) { qStart += 12; y -= 1; }
  const qEnd = qStart + 2;
  const endY = qEnd > 12 ? y + 1 : y;
  const endM = qEnd > 12 ? qEnd - 12 : qEnd;
  return {
    start: `${y}-${String(qStart).padStart(2, '0')}`,
    end: `${endY}-${String(endM).padStart(2, '0')}`,
  };
}

const presets = [
  { label: 'Este mes', getRange: () => ({ start: `${currentYear}-${currentMonth}`, end: `${currentYear}-${currentMonth}` }) },
  { label: 'Trimestre actual', getRange: getQuarterRange },
  { label: 'Trimestre anterior', getRange: getLastQuarterRange },
  { label: 'Este año', getRange: () => ({ start: `${currentYear}-01`, end: `${currentYear}-12` }) },
  { label: 'Año anterior', getRange: () => ({ start: `${currentYear - 1}-01`, end: `${currentYear - 1}-12` }) },
];

export default function RevenueMonthFilter({ startMonth, endMonth, onStartChange, onEndChange, onReset }) {
  const startYear = startMonth ? startMonth.split('-')[0] : '';
  const startMo = startMonth ? startMonth.split('-')[1] : '';
  const endYear = endMonth ? endMonth.split('-')[0] : '';
  const endMo = endMonth ? endMonth.split('-')[1] : '';

  const setStart = (year, mo) => {
    if (year && mo) onStartChange(`${year}-${mo}`);
  };
  const setEnd = (year, mo) => {
    if (year && mo) onEndChange(`${year}-${mo}`);
  };

  const applyPreset = (preset) => {
    const { start, end } = preset.getRange();
    onStartChange(start);
    onEndChange(end);
  };

  const activePreset = presets.find(p => {
    const r = p.getRange();
    return r.start === startMonth && r.end === endMonth;
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-500 flex-shrink-0" />
          <span className="text-sm text-slate-600 font-medium mr-1">Rápido:</span>
          {presets.map(p => (
            <Button
              key={p.label}
              variant={activePreset?.label === p.label ? 'default' : 'outline'}
              size="sm"
              onClick={() => applyPreset(p)}
              className="h-7 text-xs px-2.5"
            >
              {p.label}
            </Button>
          ))}
          {(startMonth || endMonth) && (
            <Button variant="ghost" size="sm" onClick={onReset} className="gap-1 text-slate-500 h-7 text-xs">
              <RotateCcw className="h-3 w-3" /> Limpiar
            </Button>
          )}
        </div>

        {/* Custom range selectors */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/50">
          <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-500 font-medium">Desde:</span>
          <Select value={startYear} onValueChange={v => setStart(v, startMo || '01')}>
            <SelectTrigger className="w-[85px] h-8 text-xs"><SelectValue placeholder="Año" /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={startMo} onValueChange={v => setStart(startYear || String(currentYear), v)}>
            <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Mes" /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <span className="text-xs text-slate-500 font-medium ml-2">Hasta:</span>
          <Select value={endYear} onValueChange={v => setEnd(v, endMo || '12')}>
            <SelectTrigger className="w-[85px] h-8 text-xs"><SelectValue placeholder="Año" /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={endMo} onValueChange={v => setEnd(endYear || String(currentYear), v)}>
            <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Mes" /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}