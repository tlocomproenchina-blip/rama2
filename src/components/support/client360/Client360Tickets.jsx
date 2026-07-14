import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Client360Section from './Client360Section';

const STATUS = {
  abierto: 'bg-blue-100 text-blue-700',
  en_proceso: 'bg-yellow-100 text-yellow-700',
  resuelto: 'bg-green-100 text-green-700',
  cerrado: 'bg-slate-100 text-slate-600'
};

export default function Client360Tickets({ tickets }) {
  return (
    <Client360Section icon={MessageSquare} title="Otros tickets" count={tickets.length}>
      {tickets.map((t) => (
        <div key={t.id} className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-800 truncate">{t.subject}</p>
            <p className="font-mono text-[10px] text-slate-500 truncate">{t.ticket_number}</p>
          </div>
          <span className="text-[10px] text-slate-400 whitespace-nowrap">
            {t.created_date ? new Date(t.created_date).toLocaleDateString('es-VE') : ''}
          </span>
          <Badge className={`text-[10px] ${STATUS[t.status] || 'bg-slate-100 text-slate-600'}`}>
            {t.status?.replace('_', ' ')}
          </Badge>
        </div>
      ))}
    </Client360Section>
  );
}