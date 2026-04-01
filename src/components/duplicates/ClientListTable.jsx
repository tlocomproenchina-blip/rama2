import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, CheckCircle, XCircle, Download, Users, Tag } from 'lucide-react';

export default function ClientListTable({ clients = [], summary = {} }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, with_sm, without_sm

  const filtered = useMemo(() => {
    let list = clients;
    if (filter === 'with_sm') list = list.filter(c => !!c.shipping_mark);
    if (filter === 'without_sm') list = list.filter(c => !c.shipping_mark);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        (c.full_name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.cedula || '').toLowerCase().includes(q) ||
        (c.shipping_mark || '').toLowerCase().includes(q) ||
        (c.whatsapp || '').includes(q)
      );
    }
    return list;
  }, [clients, search, filter]);

  const exportCSV = () => {
    const headers = ['Nombre', 'Email', 'Cédula', 'WhatsApp', 'Shipping Mark', 'Estado', 'Ciudad', 'Perfil Completo', 'Fecha Registro'];
    const rows = filtered.map(c => [
      c.full_name || '',
      c.email || '',
      c.cedula || '',
      c.whatsapp || '',
      c.shipping_mark || '',
      c.state || '',
      c.city || '',
      c.profile_completed ? 'Sí' : 'No',
      c.created_date ? new Date(c.created_date).toLocaleDateString('es-VE') : ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'clientes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-blue-200/70">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50"><Tag className="h-4 w-4 text-blue-500" /></div>
            <div>
              <p className="text-lg font-bold text-slate-800">{summary.clientsWithShippingMark || 0}</p>
              <p className="text-xs text-slate-500">Con Shipping Mark</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200/70">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50"><XCircle className="h-4 w-4 text-amber-500" /></div>
            <div>
              <p className="text-lg font-bold text-slate-800">{summary.clientsWithoutShippingMark || 0}</p>
              <p className="text-xs text-slate-500">Sin Shipping Mark</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nombre, email, cédula, SM, WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >Todos ({clients.length})</Button>
          <Button
            variant={filter === 'with_sm' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('with_sm')}
          >Con SM ({summary.clientsWithShippingMark || 0})</Button>
          <Button
            variant={filter === 'without_sm' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('without_sm')}
          >Sin SM ({summary.clientsWithoutShippingMark || 0})</Button>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50/80">
                  <th className="text-left px-3 py-2.5 font-medium text-slate-600">#</th>
                  <th className="text-left px-3 py-2.5 font-medium text-slate-600">Nombre</th>
                  <th className="text-left px-3 py-2.5 font-medium text-slate-600">Email</th>
                  <th className="text-left px-3 py-2.5 font-medium text-slate-600">Cédula</th>
                  <th className="text-left px-3 py-2.5 font-medium text-slate-600">WhatsApp</th>
                  <th className="text-left px-3 py-2.5 font-medium text-slate-600">Shipping Mark</th>
                  <th className="text-left px-3 py-2.5 font-medium text-slate-600">Estado</th>
                  <th className="text-left px-3 py-2.5 font-medium text-slate-600">Ciudad</th>
                  <th className="text-left px-3 py-2.5 font-medium text-slate-600">Perfil</th>
                  <th className="text-left px-3 py-2.5 font-medium text-slate-600">Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c, i) => (
                  <tr key={c.id || i} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || '—'}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{c.email || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{c.cedula || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{c.whatsapp || '—'}</td>
                    <td className="px-3 py-2">
                      {c.shipping_mark ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[10px]">
                          {c.shipping_mark}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">Sin asignar</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 capitalize">{c.state || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.city || '—'}</td>
                    <td className="px-3 py-2">
                      {c.profile_completed ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-amber-400" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">
                      {c.created_date ? new Date(c.created_date).toLocaleDateString('es-VE') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No se encontraron clientes con ese criterio
            </div>
          )}
          <div className="px-3 py-2 border-t bg-slate-50/50 text-xs text-slate-500">
            Mostrando {filtered.length} de {clients.length} clientes
          </div>
        </CardContent>
      </Card>
    </div>
  );
}