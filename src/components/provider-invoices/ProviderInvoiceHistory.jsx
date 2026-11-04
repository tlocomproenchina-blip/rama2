import React, { useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import ProviderInvoiceRow from './ProviderInvoiceRow';
import { piCall } from '@/lib/providerInvoicesApi';

export default function ProviderInvoiceHistory({ isAdmin, refreshKey }) {
  const [filters, setFilters] = useState({ client: '', from: '', to: '', status: 'todas' });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const set = (k, v) => setFilters((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    const data = await piCall('list', filters);
    setItems(data.items || []);
    setLoading(false);
  }, [filters]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load, refreshKey]);

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
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : items.length === 0 ? <p className="py-10 text-center text-muted-foreground">No hay facturas con esos filtros.</p>
        : <div className="grid gap-3">{items.map((inv) => <ProviderInvoiceRow key={inv.id} inv={inv} isAdmin={isAdmin} onChanged={load} />)}</div>}
    </div>
  );
}