import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function InternalConversationList({ conversations, selectedId, onSelect }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader><CardTitle>Conversaciones</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {(conversations || []).map((item) => (
          <button key={item.id} onClick={() => onSelect(item.id)} className={`w-full rounded-2xl border p-4 text-left transition-all ${selectedId === item.id ? 'border-primary bg-accent/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800">{item.title}</p>
                <p className="truncate text-sm text-slate-500">{item.entity_type}: {item.entity_label}</p>
              </div>
              <Badge className={item.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}>{item.status === 'resolved' ? 'Resuelta' : 'Abierta'}</Badge>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.last_message_preview || item.topic || 'Sin mensajes aún'}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}