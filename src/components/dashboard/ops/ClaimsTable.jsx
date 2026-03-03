import React, { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

function Table({ rows, onView }) {
  if (!rows.length) {
    return (
      <div className="p-6 text-center text-slate-500">No hay reclamos para los filtros seleccionados.</div>
    );
  }
  return (
    <div className="overflow-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="p-3 text-left">ID</th>
            <th className="p-3 text-left">Fecha</th>
            <th className="p-3 text-left">Servicio</th>
            <th className="p-3 text-left">Categoría</th>
            <th className="p-3 text-left">Estado</th>
            <th className="p-3 text-left">Monto</th>
            <th className="p-3 text-left">Cliente</th>
            <th className="p-3 text-center">Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t hover:bg-slate-50">
              <td className="p-3 font-medium">{r.id}</td>
              <td className="p-3">{r.date}</td>
              <td className="p-3">{r.service}</td>
              <td className="p-3">{r.category}</td>
              <td className="p-3">
                <Badge className={r.status === 'Open' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>
                  {r.status}
                </Badge>
              </td>
              <td className="p-3">${(r.amountUsd || 0).toFixed(2)}</td>
              <td className="p-3">{r.customer}</td>
              <td className="p-3 text-center">
                <Button variant="outline" size="sm" onClick={() => onView(r)}>View</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ClaimsTable({ claims }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const openRows = useMemo(() => claims.filter((c) => c.status === 'Open'), [claims]);
  const closedRows = useMemo(() => claims.filter((c) => c.status === 'Closed'), [claims]);

  const handleView = (row) => { setSelected(row); setOpen(true); };

  return (
    <div className="rounded-2xl border bg-white/90 backdrop-blur p-5 shadow-sm">
      <div className="mb-3">
        <p className="font-semibold text-slate-800">Reclamos</p>
        <p className="text-xs text-slate-500">Resumen y detalle</p>
      </div>
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>
        <TabsContent value="all"><Table rows={claims} onView={handleView} /></TabsContent>
        <TabsContent value="open"><Table rows={openRows} onView={handleView} /></TabsContent>
        <TabsContent value="closed"><Table rows={closedRows} onView={handleView} /></TabsContent>
      </Tabs>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[420px] sm:w-[480px]">
          <SheetHeader>
            <SheetTitle>Claim {selected?.id}</SheetTitle>
            <SheetDescription>{selected?.category} • {selected?.status}</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border bg-slate-50">
                  <div className="text-xs text-slate-500">Fecha</div>
                  <div className="font-medium">{selected.date}</div>
                </div>
                <div className="p-3 rounded-xl border bg-slate-50">
                  <div className="text-xs text-slate-500">Servicio</div>
                  <div className="font-medium">{selected.service}</div>
                </div>
                <div className="p-3 rounded-xl border bg-slate-50">
                  <div className="text-xs text-slate-500">Monto</div>
                  <div className="font-medium">${(selected.amountUsd||0).toFixed(2)}</div>
                </div>
                <div className="p-3 rounded-xl border bg-slate-50">
                  <div className="text-xs text-slate-500">Cliente</div>
                  <div className="font-medium">{selected.customer}</div>
                </div>
              </div>
              <div className="p-3 rounded-xl border bg-white">
                <div className="text-xs text-slate-500 mb-1">Notas</div>
                <p className="text-slate-700 leading-relaxed">{selected.notes}</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}