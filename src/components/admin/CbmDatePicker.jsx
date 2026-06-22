import React, { useState, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, CalendarDays, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CbmDatePicker({
  selectedDate,
  onDateChange,
  clientPackages,
  selectedTrackings,
  onTrackingsChange,
}) {
  const [viewDate, setViewDate] = useState(selectedDate || new Date());
  const [showAllPackages, setShowAllPackages] = useState(false);

  // Group packages by received date (YYYY-MM-DD)
  const packagesByDay = useMemo(() => {
    const map = {};
    (clientPackages || []).forEach((pkg) => {
      const d = pkg.received_date || pkg.created_date;
      if (!d) return;
      const key = format(new Date(d), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(pkg);
    });
    return map;
  }, [clientPackages]);

  const daysWithPackages = useMemo(
    () => Object.keys(packagesByDay).map((k) => new Date(k + 'T12:00:00')),
    [packagesByDay]
  );

  const selectedDayKey = selectedDate
    ? format(selectedDate, 'yyyy-MM-dd')
    : null;

  const packagesForSelectedDay = selectedDayKey
    ? packagesByDay[selectedDayKey] || []
    : [];

  return (
    <div className="space-y-3">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(date) => {
          if (date) onDateChange(date);
        }}
        month={viewDate}
        onMonthChange={setViewDate}
        locale={es}
        modifiers={{ hasPackages: daysWithPackages }}
        modifiersClassNames={{
          hasPackages: 'bg-emerald-100 text-emerald-800 font-bold',
        }}
        className="rounded-xl border shadow-sm"
      />

      {/* Time selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500">Hora:</label>
        <input
          type="time"
          className="flex h-9 rounded-lg border border-border/80 bg-white/90 px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/25"
          value={selectedDate ? format(selectedDate, 'HH:mm') : '10:00'}
          onChange={(e) => {
            if (!selectedDate || !e.target.value) return;
            const [h, m] = e.target.value.split(':').map(Number);
            const next = new Date(selectedDate);
            next.setHours(h, m, 0, 0);
            onDateChange(next);
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="inline-block h-3 w-3 rounded bg-emerald-100 border border-emerald-300" />
        Días con paquetes recibidos
      </div>

      {/* Packages for selected day */}
      {selectedDayKey && packagesForSelectedDay.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Package className="h-4 w-4 text-emerald-600" />
              Paquetes del{' '}
              {format(selectedDate, "dd 'de' MMMM", { locale: es })}
            </p>
            <Badge variant="outline" className="text-xs">
              {packagesForSelectedDay.length}
            </Badge>
          </div>
          <div className="max-h-44 overflow-y-auto border rounded-lg divide-y bg-white">
            {packagesForSelectedDay.map((pkg) => {
              const isSelected = selectedTrackings.includes(
                pkg.tracking_number
              );
              return (
                <div
                  key={pkg.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => {
                    const next = isSelected
                      ? selectedTrackings.filter(
                          (t) => t !== pkg.tracking_number
                        )
                      : [...selectedTrackings, pkg.tracking_number];
                    onTrackingsChange(next);
                  }}
                >
                  <Checkbox checked={isSelected} className="flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono font-medium text-slate-800 truncate">
                      {pkg.tracking_number}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {pkg.description || 'Sin descripción'}
                    </p>
                  </div>
                  <Badge
                    variant={isSelected ? 'default' : 'outline'}
                    className="text-[10px] flex-shrink-0"
                  >
                    {isSelected ? '✓' : 'Recibido'}
                  </Badge>
                </div>
              );
            })}
          </div>

          {/* Select all for this day / for all packages */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => {
                const dayTrackings = packagesForSelectedDay.map(
                  (p) => p.tracking_number
                );
                const allSelected = dayTrackings.every((t) =>
                  selectedTrackings.includes(t)
                );
                if (allSelected) {
                  onTrackingsChange(
                    selectedTrackings.filter((t) => !dayTrackings.includes(t))
                  );
                } else {
                  onTrackingsChange([
                    ...new Set([...selectedTrackings, ...dayTrackings]),
                  ]);
                }
              }}
            >
              {packagesForSelectedDay.every((p) =>
                selectedTrackings.includes(p.tracking_number)
              )
                ? 'Deseleccionar todos del día'
                : 'Seleccionar todos del día'}
            </button>

            {(clientPackages || []).length > 0 && (
              <button
                type="button"
                className="text-xs text-emerald-700 hover:underline font-medium"
                onClick={() => {
                  const allTrackings = (clientPackages || []).map((p) => p.tracking_number);
                  const allSelected = allTrackings.every((t) => selectedTrackings.includes(t));
                  if (allSelected) {
                    onTrackingsChange(selectedTrackings.filter((t) => !allTrackings.includes(t)));
                  } else {
                    onTrackingsChange([...new Set([...selectedTrackings, ...allTrackings])]);
                  }
                }}
              >
                {(clientPackages || []).every((p) => selectedTrackings.includes(p.tracking_number))
                  ? `Deseleccionar todos (${clientPackages.length})`
                  : `Seleccionar todos (${clientPackages.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Botón global cuando NO hay paquetes en el día seleccionado pero sí del cliente */}
      {(!selectedDayKey || packagesForSelectedDay.length === 0) && (clientPackages || []).length > 0 && (
        <button
          type="button"
          className="text-xs text-emerald-700 hover:underline font-medium"
          onClick={() => {
            const allTrackings = (clientPackages || []).map((p) => p.tracking_number);
            const allSelected = allTrackings.every((t) => selectedTrackings.includes(t));
            if (allSelected) {
              onTrackingsChange(selectedTrackings.filter((t) => !allTrackings.includes(t)));
            } else {
              onTrackingsChange([...new Set([...selectedTrackings, ...allTrackings])]);
            }
          }}
        >
          {(clientPackages || []).every((p) => selectedTrackings.includes(p.tracking_number))
            ? `Deseleccionar todos los paquetes del cliente (${clientPackages.length})`
            : `Seleccionar todos los paquetes del cliente (${clientPackages.length})`}
        </button>
      )}

      {selectedDayKey && packagesForSelectedDay.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-2">
          No hay paquetes recibidos en esta fecha
        </p>
      )}

      {/* Ver todos los paquetes de otros días */}
      {(clientPackages || []).length > 0 && (
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setShowAllPackages((v) => !v)}
          >
            <ListChecks className="h-4 w-4" />
            {showAllPackages ? 'Ocultar paquetes de otros días' : `Ver todos los paquetes (${clientPackages.length})`}
          </Button>

          {showAllPackages && (
            <div className="mt-2 max-h-72 overflow-y-auto space-y-3 border rounded-lg p-2 bg-white">
              {Object.keys(packagesByDay)
                .sort((a, b) => b.localeCompare(a))
                .map((dayKey) => {
                  const dayPkgs = packagesByDay[dayKey];
                  return (
                    <div key={dayKey} className="space-y-1">
                      <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 sticky top-0 bg-white py-1">
                        <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
                        {format(new Date(dayKey + 'T12:00:00'), "dd 'de' MMMM yyyy", { locale: es })}
                        <Badge variant="outline" className="text-[10px]">{dayPkgs.length}</Badge>
                      </p>
                      <div className="divide-y border rounded-lg">
                        {dayPkgs.map((pkg) => {
                          const isSelected = selectedTrackings.includes(pkg.tracking_number);
                          return (
                            <div
                              key={pkg.id}
                              className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                              onClick={() => {
                                const next = isSelected
                                  ? selectedTrackings.filter((t) => t !== pkg.tracking_number)
                                  : [...selectedTrackings, pkg.tracking_number];
                                onTrackingsChange(next);
                              }}
                            >
                              <Checkbox checked={isSelected} className="flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-mono font-medium text-slate-800 truncate">{pkg.tracking_number}</p>
                                <p className="text-[11px] text-slate-500 truncate">{pkg.description || 'Sin descripción'}</p>
                              </div>
                              <Badge variant={isSelected ? 'default' : 'outline'} className="text-[10px] flex-shrink-0">
                                {isSelected ? '✓' : 'Recibido'}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}