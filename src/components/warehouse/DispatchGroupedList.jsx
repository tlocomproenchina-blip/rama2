import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import DispatchOrderButton from '@/components/warehouse/DispatchOrderButton';

export default function DispatchGroupedList({ scans }) {
  const groups = {};
  scans.forEach((s) => {
    if (s.error) return;
    const key = s.package?.client_email || 'desconocido';
    if (!groups[key]) {
      groups[key] = {
        name: s.client?.full_name || key,
        mark: s.package?.shipping_mark || s.client?.shipping_mark,
        items: []
      };
    }
    groups[key].items.push(s);
  });

  const entries = Object.entries(groups);
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Agrupado por cliente ({entries.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map(([email, group]) => (
          <div key={email} className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div>
                <p className="font-semibold text-slate-800 break-all">{group.name}</p>
                {group.mark && <p className="font-mono text-xs text-blue-700">Mark: {group.mark}</p>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{group.items.length} paquete{group.items.length !== 1 ? 's' : ''}</Badge>
                <DispatchOrderButton group={group} email={email} />
              </div>
            </div>
            <ul className="space-y-1">
              {group.items.map((item, idx) => (
                <li key={idx} className="text-sm text-slate-600 flex items-center gap-2 flex-wrap">
                  <span className="font-mono break-all">{item.package?.tracking_number}</span>
                  {item.auto_received && (
                    <Badge variant="outline" className="border-blue-300 text-blue-700 text-[10px] px-1.5 py-0">auto-recibido</Badge>
                  )}
                  {item.already_dispatched && (
                    <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px] px-1.5 py-0">ya despachado</Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}