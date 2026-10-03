import React from 'react';
import moment from 'moment';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const badges = {
  creado: 'bg-emerald-100 text-emerald-700',
  existente: 'bg-sky-100 text-sky-700',
  error: 'bg-rose-100 text-rose-700',
};

const labels = { creado: 'Cuenta nueva', existente: 'Ya existía', error: 'Con error' };

export default function WholesalerClientsTable({ clients = [], loading }) {
  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }

  if (!clients.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No hay clientes del mayorista en este período.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Cédula</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead>Ciudad / Estado</TableHead>
            <TableHead>Shipping Mark</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Traído</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.full_name || '—'}</TableCell>
              <TableCell className="text-xs">{c.email}</TableCell>
              <TableCell className="text-xs">{c.cedula || '—'}</TableCell>
              <TableCell className="text-xs">{c.whatsapp || '—'}</TableCell>
              <TableCell className="text-xs">{[c.city, c.state].filter(Boolean).join(', ') || '—'}</TableCell>
              <TableCell className="font-mono text-xs">{c.shipping_mark || '—'}</TableCell>
              <TableCell>
                <Badge className={badges[c.status] || 'bg-slate-100 text-slate-600'} title={c.message || ''}>
                  {labels[c.status] || c.status}
                </Badge>
                {c.report_sent && <span className="ml-2 text-[11px] text-muted-foreground">en el informe</span>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">
                {c.fetched_date ? moment(c.fetched_date).format('DD/MM HH:mm') : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}