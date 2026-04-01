import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TimerReset, Clock3, Users, Activity } from 'lucide-react';

const formatHours = (hours) => {
  if (!Number.isFinite(hours) || hours <= 0) return '0 min';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1)} h`;
};

export default function AdminSupportRealtimeKpis({ tickets, staffUsers }) {
  const metrics = useMemo(() => {
    const responseTimes = tickets
      .map((ticket) => {
        const messages = ticket.messages || [];
        for (let i = 0; i < messages.length; i++) {
          if (!messages[i].is_admin) {
            const clientTime = new Date(messages[i].timestamp).getTime();
            const adminReply = messages.slice(i + 1).find((message) => message.is_admin);
            if (adminReply) {
              const adminTime = new Date(adminReply.timestamp).getTime();
              return (adminTime - clientTime) / (1000 * 60 * 60);
            }
          }
        }
        return null;
      })
      .filter((value) => Number.isFinite(value) && value >= 0);

    const avgResponseHours = responseTimes.length
      ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length
      : 0;

    const activeAgents = new Set(
      tickets.filter((ticket) => ticket.assigned_to).map((ticket) => ticket.assigned_to)
    ).size;

    const openWorkload = tickets.filter((ticket) => ['abierto', 'en_proceso'].includes(ticket.status)).length;
    const avgLoadPerAgent = activeAgents ? openWorkload / activeAgents : 0;
    const resolvedToday = tickets.filter((ticket) => {
      if (!ticket.resolved_date) return false;
      const resolved = new Date(ticket.resolved_date);
      const now = new Date();
      return resolved.toDateString() === now.toDateString();
    }).length;

    return [
      {
        label: 'Tiempo prom. respuesta',
        value: formatHours(avgResponseHours),
        helper: `${responseTimes.length} conversaciones medidas`,
        icon: TimerReset,
        accent: 'text-blue-600',
        bg: 'bg-blue-50'
      },
      {
        label: 'Carga por agente',
        value: activeAgents ? avgLoadPerAgent.toFixed(1) : '0',
        helper: `${openWorkload} tickets activos`,
        icon: Activity,
        accent: 'text-violet-600',
        bg: 'bg-violet-50'
      },
      {
        label: 'Agentes con carga',
        value: `${activeAgents}/${staffUsers.length || 0}`,
        helper: 'asignados en tiempo real',
        icon: Users,
        accent: 'text-emerald-600',
        bg: 'bg-emerald-50'
      },
      {
        label: 'Resueltos hoy',
        value: resolvedToday,
        helper: 'cierres del día',
        icon: Clock3,
        accent: 'text-amber-600',
        bg: 'bg-amber-50'
      }
    ];
  }, [tickets, staffUsers]);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className={`mt-2 text-3xl font-bold ${item.accent}`}>{item.value}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.helper}</p>
                </div>
                <div className={`rounded-2xl p-3 ${item.bg}`}>
                  <Icon className={`h-6 w-6 ${item.accent}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}