import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import EmployeeOperationsCard from './EmployeeOperationsCard';

export default function EmployeeOperationsPanel({ employees, loading, error, rangeLabel }) {
  const areas = useMemo(() => {
    const groups = {};
    (employees || []).forEach((e) => {
      (groups[e.area_name] = groups[e.area_name] || []).push(e);
    });
    return Object.entries(groups);
  }, [employees]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Trabajo realizado por empleado</h2>
        <p className="text-sm text-slate-500">Registros reales del periodo: {rangeLabel}</p>
      </div>
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : areas.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No hay empleados para el filtro seleccionado.</div>
      ) : (
        areas.map(([areaName, list]) => (
          <div key={areaName} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">{areaName}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              {list.map((employee) => <EmployeeOperationsCard key={employee.email} employee={employee} />)}
            </div>
          </div>
        ))
      )}
    </section>
  );
}