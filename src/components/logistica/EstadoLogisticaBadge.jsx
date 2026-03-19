import React from 'react';
import { Badge } from '@/components/ui/badge';

const styles = {
  disponible: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  en_ruta: 'bg-blue-100 text-blue-700 border-blue-200',
  en_curso: 'bg-blue-100 text-blue-700 border-blue-200',
  mantenimiento: 'bg-amber-100 text-amber-700 border-amber-200',
  suspendido: 'bg-amber-100 text-amber-700 border-amber-200',
  inactivo: 'bg-slate-100 text-slate-700 border-slate-200',
  planificada: 'bg-violet-100 text-violet-700 border-violet-200',
  asignada: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  completada: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelada: 'bg-rose-100 text-rose-700 border-rose-200',
};

export default function EstadoLogisticaBadge({ value }) {
  return (
    <Badge variant="outline" className={styles[value] || 'bg-slate-100 text-slate-700 border-slate-200'}>
      {String(value || 'sin_estado').replaceAll('_', ' ')}
    </Badge>
  );
}