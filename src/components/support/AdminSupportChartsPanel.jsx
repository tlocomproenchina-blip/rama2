import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLORS = ['#60A5FA', '#FBBF24', '#34D399', '#94A3B8', '#A78BFA'];

export default function AdminSupportChartsPanel({ tickets, staffUsers }) {
  const workloadData = useMemo(() => {
    return staffUsers
      .map((agent) => {
        const assigned = tickets.filter((ticket) => ticket.assigned_to === agent.email);
        return {
          name: (agent.full_name || agent.email).split(' ')[0],
          abiertos: assigned.filter((ticket) => ticket.status === 'abierto').length,
          en_proceso: assigned.filter((ticket) => ticket.status === 'en_proceso').length,
          resueltos: assigned.filter((ticket) => ticket.status === 'resuelto').length,
          total: assigned.length,
        };
      })
      .filter((agent) => agent.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [tickets, staffUsers]);

  const statusData = useMemo(() => {
    const statuses = [
      { name: 'Abiertos', value: tickets.filter((ticket) => ticket.status === 'abierto').length },
      { name: 'En proceso', value: tickets.filter((ticket) => ticket.status === 'en_proceso').length },
      { name: 'Resueltos', value: tickets.filter((ticket) => ticket.status === 'resuelto').length },
      { name: 'Cerrados', value: tickets.filter((ticket) => ticket.status === 'cerrado').length },
    ];
    return statuses.filter((item) => item.value > 0);
  }, [tickets]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Carga de trabajo por agente</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={workloadData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="abiertos" stackId="a" fill="#60A5FA" radius={[6, 6, 0, 0]} />
              <Bar dataKey="en_proceso" stackId="a" fill="#FBBF24" radius={[6, 6, 0, 0]} />
              <Bar dataKey="resueltos" stackId="a" fill="#34D399" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Distribución de estados</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={4}>
                {statusData.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {statusData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span>{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}