import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCcw } from 'lucide-react';

export default function AdminAccountsPayable() {
  const [loading, setLoading] = useState(true);
  const [aps, setAps] = useState([]);
  const [filter, setFilter] = useState('todas');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.AccountsPayable.list('-created_date', 300);
      setAps(list);
    } catch (e) {
      console.error('Error loading AP:', e);
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (filter === 'todas') return aps;
    return aps.filter(a => a.status === filter);
  }, [aps, filter]);

  const totals = useMemo(() => {
    const totalOriginal = filtered.reduce((s, a) => s + (a.original_amount_due || 0), 0);
    const totalPaid = filtered.reduce((s, a) => s + (a.amount_paid || 0), 0);
    const totalBalance = filtered.reduce((s, a) => s + (a.balance_due || 0), 0);
    return { totalOriginal, totalPaid, totalBalance };
  }, [filtered]);

  const statusBadge = (status) => {
    const map = {
      pendiente: 'bg-yellow-100 text-yellow-800',
      parcial: 'bg-blue-100 text-blue-800',
      pagado: 'bg-green-100 text-green-800',
      vencido: 'bg-red-100 text-red-800',
      disputa: 'bg-rose-100 text-rose-800'
    };
    return <Badge className={map[status] || 'bg-slate-100 text-slate-800'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Cuentas por Pagar</h1>
          <p className="text-slate-500">Gestión de AP generadas por consolidaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refrescar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle>Resumen</CardTitle>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="todas">Todas</TabsTrigger>
              <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
              <TabsTrigger value="parcial">Parciales</TabsTrigger>
              <TabsTrigger value="pagado">Pagadas</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-16 flex items-center justify-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-lg border bg-slate-50">
                  <p className="text-xs text-slate-500">Total Original</p>
                  <p className="text-xl font-semibold text-slate-800">${totals.totalOriginal.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-lg border bg-slate-50">
                  <p className="text-xs text-slate-500">Pagado</p>
                  <p className="text-xl font-semibold text-slate-800">${totals.totalPaid.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-lg border bg-slate-50">
                  <p className="text-xs text-slate-500">Saldo</p>
                  <p className="text-xl font-semibold text-slate-800">${totals.totalBalance.toFixed(2)}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Original</TableHead>
                      <TableHead className="text-right">Pagado</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-500">Sin registros</TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(ap => (
                        <TableRow key={ap.id}>
                          <TableCell className="font-medium">{ap.vendor_name || 'Proveedor'}</TableCell>
                          <TableCell className="max-w-[360px] truncate">{ap.description}</TableCell>
                          <TableCell className="text-right">${(ap.original_amount_due || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right">${(ap.amount_paid || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right">${(ap.balance_due || 0).toFixed(2)}</TableCell>
                          <TableCell>{statusBadge(ap.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}