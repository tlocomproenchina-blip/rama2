import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ClienteBultosCard from '@/components/logistica/ClienteBultosCard';

export default function ClienteBultosResumen({ cargas }) {
  const groups = useMemo(() => {
    const map = {};
    cargas.forEach((c) => {
      const email = String(c.cliente_email || '').trim().toLowerCase();
      if (!email) return;
      const g = map[email] || (map[email] = { email, cargas: 0, bultos: 0, estados: {} });
      const estado = c.estado_entrega || 'pendiente';
      g.cargas += 1;
      g.bultos += Number(c.cantidad_bultos) || 1;
      g.estados[estado] = (g.estados[estado] || 0) + 1;
    });
    return Object.values(map).sort((a, b) => b.bultos - a.bultos);
  }, [cargas]);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Bultos por cliente</CardTitle>
        <CardDescription>Total de bultos en ruta y su estado de entrega. Abre un cliente para ver las etiquetas de sus bultos.</CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-slate-500">No hay cargas con cliente asignado.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.map((g) => <ClienteBultosCard key={g.email} group={g} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}