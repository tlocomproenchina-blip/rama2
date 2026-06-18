import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCcw, Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export default function AdminAccountsPayable({ user }) {
  const [loading, setLoading] = useState(true);
  const [aps, setAps] = useState([]);
  const [filter, setFilter] = useState('todas');
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [hasMore, setHasMore] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await base44.functions.invoke('recalculateProviderCosts', {});
      const d = res?.data || {};
      if (d.success) {
        toast.success(`Recalculadas ${d.updated} factura(s) manual(es)`);
        setPage(0);
        await loadData();
      } else {
        toast.error(d.error || 'No se pudo recalcular');
      }
    } catch (e) {
      console.error(e);
      toast.error('No se pudo recalcular');
    } finally {
      setRecalculating(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.AccountsPayable.list('-created_date', pageSize, page * pageSize);
      setAps(list);
      setHasMore(list.length === pageSize);
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

  // Selección y pagos
  const [selectedIds, setSelectedIds] = useState([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMode, setPayMode] = useState('full'); // 'full' | 'partial'
  const [payAmount, setPayAmount] = useState(''); // por AP cuando es parcial
  const [payMethod, setPayMethod] = useState('transferencia');
  const [payReference, setPayReference] = useState('');
  const [processing, setProcessing] = useState(false);

  const selectedBalanceTotal = useMemo(() => {
    const sel = aps.filter(a => selectedIds.includes(a.id));
    return sel.reduce((s, a) => s + (a.balance_due || 0), 0);
  }, [aps, selectedIds]);

  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? filtered.map(a => a.id) : []);
  };
  const handleSelect = (id, checked) => {
    setSelectedIds(prev => checked ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id));
  };

  const openPayModal = (mode) => {
    setPayMode(mode);
    if (mode === 'partial') setPayAmount('');
    setShowPayModal(true);
  };

  const confirmPayment = async () => {
    try {
      setProcessing(true);
      const nowIso = new Date().toISOString();
      const sel = aps.filter(a => selectedIds.includes(a.id));

      // Calcular montos aplicados por AP (plan)
      const plans = sel.map((ap) => {
        const original = Number(ap.original_amount_due || 0);
        const already = Number(ap.amount_paid || 0);
        const balance = Math.max(original - already, 0);
        const amount = payMode === 'full' ? balance : Math.min(Number(payAmount || 0), balance);
        return { ap, amount, original, already, balance };
      }).filter(p => p.amount > 0);

      if (plans.length === 0) return;

      // Agrupar por proveedor
      const groups = plans.reduce((acc, p) => {
        const key = p.ap.vendor_name || 'Proveedor';
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});

      // Procesar por proveedor: crear ProviderPayment, actualizar APs y ledger de ambos
      await Promise.all(Object.entries(groups).map(async ([providerName, items]) => {
        const total = items.reduce((s, it) => s + it.amount, 0);
        // Intentar obtener provider_id (opcional)
        let providerId = null;
        try {
          const provs = await base44.entities.ShippingProvider.filter({ name: providerName });
          providerId = provs[0]?.id || null;
        } catch {}

        // Crear ProviderPayment
        const pp = await base44.entities.ProviderPayment.create({
          provider_id: providerId || undefined,
          provider_name: providerName,
          payment_date: nowIso,
          method: payMethod,
          reference: payReference || '',
          total_amount: total,
          notes: payMode === 'full' ? 'Pago total desde AP' : 'Pago parcial desde AP',
          allocations: items.map(it => ({ ap_id: it.ap.id, amount: it.amount }))
        });

        // Actualizar APs + Ledger (referenciando el ProviderPayment creado)
        await Promise.all(items.map(async (it) => {
          const newPaid = it.already + it.amount;
          const newBalance = Math.max(it.original - newPaid, 0);
          const newStatus = newBalance === 0 ? 'pagado' : (newPaid > 0 ? 'parcial' : 'pendiente');

          await base44.entities.AccountsPayable.update(it.ap.id, {
            amount_paid: newPaid,
            balance_due: newBalance,
            status: newStatus,
            payment_date: nowIso,
            payment_reference: payReference || it.ap.payment_reference || ''
          });
          await base44.entities.AccountsPayableLedger.create({
            ap_id: it.ap.id,
            transaction_type: 'abono',
            amount: it.amount,
            transaction_date: nowIso,
            method: payMethod,
            reference: payReference ? `${payReference} | PP:${pp.id}` : `PP:${pp.id}`,
            description: payMode === 'full' ? 'Pago total' : 'Pago parcial',
            created_by: user?.email || 'system'
          });
        }));

        // Registrar en ledger de proveedor
        await base44.entities.ProviderPaymentLedger.create({
          provider_id: providerId || undefined,
          provider_name: providerName,
          transaction_type: 'pago',
          amount: total,
          transaction_date: nowIso,
          method: payMethod,
          reference: payReference || `PP:${pp.id}`,
          description: `Pago desde Cuentas por Pagar (${items.length} AP)`
        });
      }));

      toast.success('Pago registrado');
      setShowPayModal(false);
      setSelectedIds([]);
      await loadData();
    } catch (e) {
      console.error(e);
      toast.error('No se pudo registrar el pago');
    } finally {
      setProcessing(false);
    }
  };

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
          <Button variant="outline" size="sm" onClick={() => { setPage(0); loadData(); }}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Refrescar
          </Button>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={handleRecalculate} disabled={recalculating}>
            {recalculating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
            Recalcular costos
          </Button>
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
            Prev
          </Button>
          <Button variant="outline" size="sm" disabled={!hasMore && aps.length < pageSize} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
          <span className="text-xs text-slate-500">Página {page + 1}</span>
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

              {selectedIds.length > 0 && (
                <div className="p-3 rounded-lg bg-blue-50 border flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-slate-700">
                    Seleccionados: <strong>{selectedIds.length}</strong> • Saldo total: <strong>${selectedBalanceTotal.toFixed(2)}</strong>
                  </div>
                  <div className="flex gap-2">
                    {selectedBalanceTotal > 0 && (
                      <>
                        <Button variant="outline" onClick={() => openPayModal('partial')}>Abonar</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => openPayModal('full')}>Pagar</Button>
                      </>
                    )}
                    <Button variant="ghost" onClick={() => setSelectedIds([])}>Limpiar</Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filtered.length > 0 && selectedIds.length === filtered.length}
                          onCheckedChange={(v) => handleSelectAll(!!v)}
                          aria-label="Seleccionar todos"
                        />
                      </TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Estado destino</TableHead>
                      <TableHead>Creado</TableHead>
                      <TableHead className="text-right">Original</TableHead>
                      <TableHead className="text-right">Pagado</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-slate-500">Sin registros</TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(ap => (
                        <TableRow key={ap.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(ap.id)}
                              onCheckedChange={(v) => handleSelect(ap.id, !!v)}
                              aria-label="Seleccionar AP"
                            />
                          </TableCell>
                          <TableCell className="font-medium">{ap.vendor_name || 'Proveedor'}</TableCell>
                          <TableCell className="max-w-[360px] truncate">{ap.description}</TableCell>
                          <TableCell>{ap.state_code ? ap.state_code.split('_').map(s => s.charAt(0).toUpperCase()+s.slice(1)).join(' ') : '—'}</TableCell>
                          <TableCell>{ap.created_date ? new Date(ap.created_date).toLocaleString() : '—'}</TableCell>
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

      {/* Modal de Pago/Abono */}
      <Dialog open={showPayModal} onOpenChange={setShowPayModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{payMode === 'full' ? 'Pagar seleccionado(s)' : 'Abonar seleccionado(s)'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-slate-600">
              Seleccionados: {selectedIds.length} • Saldo total: ${selectedBalanceTotal.toFixed(2)}
            </div>
            {payMode === 'partial' && (
              <div>
                <Label>Monto a abonar (por AP)</Label>
                <Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Método</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="nota_credito">Nota de crédito</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Referencia</Label>
                <Input value={payReference} onChange={e => setPayReference(e.target.value)} placeholder="Comprobante / ref" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayModal(false)}>Cancelar</Button>
            <Button onClick={confirmPayment} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}