import React from 'react';
import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Client360Section from './Client360Section';

const STATUS = {
  pre_alerta: { label: 'Pre-Alerta', cls: 'bg-amber-100 text-amber-700' },
  recibido: { label: 'Recibido', cls: 'bg-blue-100 text-blue-700' },
  rechazado: { label: 'Rechazado', cls: 'bg-red-100 text-red-700' },
  consolidado: { label: 'Consolidado', cls: 'bg-purple-100 text-purple-700' },
  en_transito: { label: 'En Tránsito', cls: 'bg-cyan-100 text-cyan-700' },
  disponible: { label: 'Disponible', cls: 'bg-green-100 text-green-700' },
  despachado: { label: 'Despachado', cls: 'bg-indigo-100 text-indigo-700' },
  entregado: { label: 'Entregado', cls: 'bg-slate-100 text-slate-700' }
};

export default function Client360Packages({ packages }) {
  return (
    <Client360Section icon={Package} title="Paquetes / Pre-alertas" count={packages.length}>
      {packages.map((p) => (
        <div key={p.id} className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-slate-800 truncate">{p.tracking_number}</p>
            <p className="text-xs text-slate-500 truncate">{p.description}</p>
          </div>
          <span className="text-[10px] text-slate-400 whitespace-nowrap">
            {p.created_date ? new Date(p.created_date).toLocaleDateString('es-VE') : ''}
          </span>
          <Badge className={`text-[10px] ${STATUS[p.status]?.cls || 'bg-slate-100 text-slate-600'}`}>
            {STATUS[p.status]?.label || p.status}
          </Badge>
        </div>
      ))}
    </Client360Section>
  );
}