import React, { useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import ProviderInvoiceRow from './ProviderInvoiceRow';
import ProviderInvoiceTotals from './ProviderInvoiceTotals';
import ProviderSelectionBar from './ProviderSelectionBar';
import ProviderPayDialog from './ProviderPayDialog';
import { piCall } from '@/lib/providerInvoicesApi';

export default function ProviderInvoiceHistory({ isAdmin, refreshKey }) {
  const [filters, setFilters] = useState({ client: '', from: '', to: '', status: 'todas' });
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [paying, setPaying] = useState(null);
  const set = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    const data = await piCall('list', filters);
    const list = data.items || [];
    setItems(list);
    setTotals(data.totals || null);
    setSelectedIds((ids) => ids.filter((id) => list.some((i) => i.id === id)));
    setLoading(false);
  }, [filters]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load, refreshKey]);

  const selected = items.filter((i) => selectedIds.includes(i.id));
  const toggle = (id) => setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const afterPaid = () => { setSelectedIds([]); load(); };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Input placeholder="Cliente, Shipping Mark o contenedor" value={filters.client} onChange={(e) => set('client', e.target.value)} />
        <Input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
        <Input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
        <Select value={filters.status} onValueChange={(v) => set('status', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="pagada">Pagadas</SelectItem>
            <SelectItem value="pendiente">No pagadas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ProviderInvoiceTotals totals={totals} />
      <ProviderSelectionBar selected={selected} isAdmin={isAdmin} onClear={() => setSelectedIds([])} onPay={setPaying} />
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : items.length === 0 ? <p className="py-10 text-center text-muted-foreground">No hay facturas con esos filtros.</p>
        : (
          <>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={allSelected} onCheckedChange={() => setSelectedIds(allSelected ? [] : items.map((i) => i.id))} />
              Seleccionar todas ({items.length})
            </label>
            <div className="grid gap-3">{items.map((inv) => (
              <ProviderInvoiceRow key={inv.id} inv={inv} isAdmin={isAdmin} onChanged={load}
                selected={selectedIds.includes(inv.id)} onToggle={() => toggle(inv.id)} onPay={() => setPaying([inv])} />
            ))}</div>
          </>
        )}
      {paying && <ProviderPayDialog invoices={paying} open={!!paying} onOpenChange={(o) => !o && setPaying(null)} onPaid={afterPaid} />}
    </div>
  );
}