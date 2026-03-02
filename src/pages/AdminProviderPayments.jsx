import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Banknote, CheckCircle2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminProviderPayments({ user }) {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [provider, setProvider] = useState(null);
  const [aps, setAps] = useState([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('transferencia');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString());
  const [allocations, setAllocations] = useState({}); // apId -> amount
  const [processing, setProcessing] = useState(false);

  useEffect(() => { loadProviders(); }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.ShippingProvider.list('-created_date', 200);
      setProviders(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (selectedProviderId) loadAPs(); else { setProvider(null); setAps([]);} }, [selectedProviderId]);

  const loadAPs = async () => {
    try {
      const prov = providers.find(p => p.id === selectedProviderId);
      setProvider(prov || null);
      if (!prov) { setAps([]); return; }
      const list = await base44.entities.AccountsPayable.filter({ vendor_name: prov.name });
      setAps(list);
      // Pre-fill allocations with 0
      const map = {};
      list.forEach(a => { map[a.id] = ''; });
      setAllocations(map);
    } catch (e) { console.error(e); }
  };

  const balanceFor = (ap) => Number(ap.balance_due || Math.max((ap.original_amount_due||0) - (ap.amount_paid||0), 0));

  const totalAllocated = useMemo(() => {
    return Object.entries(allocations).reduce((s, [apId, val]) => s + (Number(val) || 0), 0);
  }, [allocations]);

  const remaining = useMemo(() => {
    return Math.max((Number(amount || 0) - totalAllocated), 0);
  }, [amount, totalAllocated]);

  const autoAllocate = () => {
    const target = Number(amount || 0);
    if (!target || target <= 0) { toast.error('Monto inválido'); return; }
    let left = target;
    const map = { ...allocations };
    for (const ap of aps.filter(a => a.status !== 'pagado')) {
      const bal = balanceFor(ap);
      const take = Math.min(bal, left);
      map[ap.id] = take > 0 ? String(take) : '';
      left -= take;
      if (left <= 0) break;
    }
    setAllocations(map);
  };

  const valid = useMemo(() => {
    const target = Number(amount || 0);
    if (!provider || target <= 0) return false;
    // allocations must equal target and not exceed balances
    if (Math.abs(totalAllocated - target) > 0.009) return false;
    for (const ap of aps) {
      const val = Number(allocations[ap.id] || 0);
      if (val < 0) return false;
      if (val > balanceFor(ap) + 1e-6) return false;
    }
    return true;
  }, [provider, amount, allocations, aps, totalAllocated]);

  const submitPayment = async () => {
    if (!valid) { toast.error('Verifica el monto y las asignaciones'); return; }
    setProcessing(true);
    try {
      const target = Number(amount);
      const allocArray = Object.entries(allocations)
        .map(([apId, val]) => ({ ap_id: apId, amount: Number(val||0) }))
        .filter(x => x.amount > 0);

      // Create ProviderPayment
      const pp = await base44.entities.ProviderPayment.create({
        provider_id: provider.id,
        provider_name: provider.name,
        payment_date: date,
        method,
        reference,
        total_amount: target,
        notes,
        allocations: allocArray
      });

      // Update APs + AP ledger entries
      await Promise.all(allocArray.map(async (al) => {
        const ap = aps.find(a => a.id === al.ap_id);
        if (!ap) return;
        const original = Number(ap.original_amount_due || 0);
        const already = Number(ap.amount_paid || 0);
        const newPaid = already + al.amount;
        const newBalance = Math.max(original - newPaid, 0);
        const newStatus = newBalance === 0 ? 'pagado' : (newPaid > 0 ? 'parcial' : 'pendiente');
        await base44.entities.AccountsPayable.update(ap.id, {
          amount_paid: newPaid,
          balance_due: newBalance,
          status: newStatus,
          payment_date: date,
          payment_reference: reference
        });
        await base44.entities.AccountsPayableLedger.create({
          ap_id: ap.id,
          transaction_type: 'abono',
          amount: al.amount,
          transaction_date: date,
          method,
          reference: reference ? `${reference} | PP:${pp.id}` : `PP:${pp.id}`,
          description: `Pago proveedor ${provider.name}`,
          created_by: user?.email || 'system'
        });
      }));

      // Provider ledger
      await base44.entities.ProviderPaymentLedger.create({
        provider_id: provider.id,
        provider_name: provider.name,
        transaction_type: 'pago',
        amount: target,
        transaction_date: date,
        method,
        reference,
        description: `Pago a proveedor con ${allocArray.length} asignación(es)`
      });

      toast.success('Pago procesado');
      // Reset
      setAmount(''); setReference(''); setNotes(''); setAllocations({});
      await loadAPs();
    } catch (e) {
      console.error(e);
      toast.error('No se pudo procesar el pago');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Pagos a Proveedores</h1>
          <p className="text-slate-500">Registra pagos y distribúyelos a Cuentas por Pagar</p>
        </div>
        <Button variant="outline" onClick={() => { loadProviders(); if (selectedProviderId) loadAPs(); }}>
          <RefreshCcw className="h-4 w-4 mr-2"/>Refrescar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formulario de Pago</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Proveedor</Label>
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Método</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
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
              <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Comprobante / Ref" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="datetime-local" value={new Date(date).toISOString().slice(0,16)} onChange={e => setDate(new Date(e.target.value).toISOString())} />
            </div>
            <div>
              <Label>Monto Total</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Notas</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Asignar a Cuentas por Pagar</h3>
              <div className="text-sm text-slate-600">Asignado: ${totalAllocated.toFixed(2)} • Restante: ${remaining.toFixed(2)}</div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right w-48">Asignar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500">Sin AP para este proveedor</TableCell>
                    </TableRow>
                  ) : (
                    aps.map(ap => (
                      <TableRow key={ap.id}>
                        <TableCell className="max-w-[360px] truncate">{ap.description}</TableCell>
                        <TableCell className="text-right">${(ap.original_amount_due||0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">${(ap.amount_paid||0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">${balanceFor(ap).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          {balanceFor(ap) <= 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <Input
                              type="number" step="0.01"
                              value={allocations[ap.id] ?? ''}
                              onChange={e => setAllocations({ ...allocations, [ap.id]: e.target.value })}
                              placeholder="0.00"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button variant="outline" onClick={autoAllocate}>Auto-asignar</Button>
              <Button onClick={submitPayment} disabled={!valid || processing} className="bg-emerald-600 hover:bg-emerald-700">
                {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Procesar Pago
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Últimos pagos */}
      <RecentProviderPayments providerId={selectedProviderId} onRefresh={loadAPs} />
    </div>
  );
}

function RecentProviderPayments({ providerId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (providerId) load(); }, [providerId]);

  const load = async () => {
    setLoading(true);
    try {
      const provs = await base44.entities.ShippingProvider.list();
      const prov = provs.find(p => p.id === providerId);
      if (!prov) { setItems([]); setLoading(false); return; }

      // Buscar por provider_id y también por provider_name (para pagos creados desde AP)
      const [byId, byName] = await Promise.all([
        base44.entities.ProviderPayment.filter({ provider_id: prov.id }, '-created_date', 10),
        base44.entities.ProviderPayment.filter({ provider_name: prov.name }, '-created_date', 10)
      ]);

      // Unificar y ordenar por created_date desc, quitando duplicados
      const map = new Map();
      [...byId, ...byName].forEach(pp => { if (pp) map.set(pp.id, pp); });
      const combined = Array.from(map.values()).sort((a,b) => new Date(b.created_date) - new Date(a.created_date));

      setItems(combined.slice(0, 10));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (!providerId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos Recientes</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 text-slate-500 flex items-center justify-center"><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Cargando…</div>
        ) : items.length === 0 ? (
          <div className="text-slate-500 py-4">No hay pagos recientes</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.payment_date).toLocaleString()}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell>{p.reference || '—'}</TableCell>
                    <TableCell className="text-right">${(p.total_amount||0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}