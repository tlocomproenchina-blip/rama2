import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function InternalMessagingStats({ total, open, resolved, messages }) {
  const items = [
    { label: 'Conversaciones', value: total },
    { label: 'Abiertas', value: open },
    { label: 'Resueltas', value: resolved },
    { label: 'Mensajes', value: messages },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="border-0 shadow-lg">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}