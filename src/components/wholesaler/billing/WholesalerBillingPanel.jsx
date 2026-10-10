import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Receipt, RefreshCw } from 'lucide-react';
import WholesalerBillingClientPicker from './WholesalerBillingClientPicker';
import WholesalerBillingClientCard from './WholesalerBillingClientCard';
import WholesalerBillingSummary from './WholesalerBillingSummary';
import WholesalerBillingResult from './WholesalerBillingResult';
import WholesalerBillingHistory from './WholesalerBillingHistory';
import { draftOrders, invoiceTotals } from '@/lib/wholesalerBillingCalc';

function toArray(rows) {
  return Array.isArray(rows) ? rows : rows?.items || [];
}

function buildDraft(row) {
  return {
    client_id: row.id,
    client_email: row.email,
    client_name: row.full_name || row.email,
    shipping_mark: row.shipping_mark || '',
    rate_per_bulto: Number(row.rate_per_bulto) || 0,
    door_to_door_per_bulto: Number(row.door_to_door_per_bulto) || 0,
    orders: (row.orders || []).map((order) => ({
      order_number: order.order_number,
      cbm: Number(order.cbm) || 0,
      bultos: Number(order.bultos ?? order.trackings_count) || 0,
      trackings_count: order.trackings_count || 0,
      received: Number(order.received) || 0,
      picked: [],
      is_new: false,
      checked: true,
    })),
    available: row.available_trackings || [],
  };
}

// Facturar a los clientes de un mayorista: se eligen varios clientes, se arman
// sus órdenes/envíos con sus bultos y sale una sola factura, con el correo de
// cada cliente llevando su parte.
export default function WholesalerBillingPanel({ initialWholesaler }) {
  const [groups, setGroups] = useState([]);
  const [wholesaler, setWholesaler] = useState('');
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [notes, setNotes] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadGroups = useCallback(async () => {
    try {
      const response = await base44.functions.invoke('getWholesalerBillingCandidates', {});
      setGroups(response?.data?.groups || []);
    } catch (error) {
      toast.error(error?.message || 'No se pudieron cargar los mayoristas.');
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // El mayorista sale de los mismos clientes, así que también aparecen los de
  // una conexión que se quitó después.
  useEffect(() => {
    if (wholesaler || !groups.length) return;
    const preferred = groups.find((group) => group.key === initialWholesaler);
    setWholesaler(preferred ? preferred.key : groups[0].key);
  }, [groups, initialWholesaler, wholesaler]);

  const loadClients = useCallback(async () => {
    if (!wholesaler) return;
    setLoading(true);
    try {
      const response = await base44.functions.invoke('getWholesalerBillingCandidates', { wholesaler_key: wholesaler });
      setClients(response?.data?.clients || []);
    } catch (error) {
      toast.error(error?.message || 'No se pudieron cargar los clientes del mayorista.');
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [wholesaler]);

  const loadInvoices = useCallback(async () => {
    if (!wholesaler) return;
    setHistoryLoading(true);
    try {
      const rows = await base44.entities.WholesalerInvoice.filter({ wholesaler_key: wholesaler }, '-emitted_date', 20);
      setInvoices(toArray(rows));
    } catch (_) {
      setInvoices([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [wholesaler]);

  const clearLot = useCallback(() => {
    setSelected([]);
    setDrafts({});
    setNotes('');
  }, []);

  useEffect(() => {
    clearLot();
    setResult(null);
  }, [wholesaler, clearLot]);

  useEffect(() => {
    loadClients();
    loadInvoices();
  }, [loadClients, loadInvoices]);

  // El detalle de un cliente (sus órdenes, sus trackings recibidos y sus
  // trackings todavía libres) se pide solo cuando se elige para facturar.
  useEffect(() => {
    const pending = selected.filter((email) => !drafts[email]);
    if (!pending.length || !wholesaler) return undefined;
    let cancelled = false;
    setDetailLoading(true);
    base44.functions.invoke('getWholesalerBillingCandidates', { wholesaler_key: wholesaler, client_emails: pending })
      .then((response) => {
        if (cancelled) return;
        const rows = response?.data?.clients || [];
        setDrafts((prev) => {
          const next = { ...prev };
          for (const row of rows) {
            if (!next[row.email]) next[row.email] = buildDraft(row);
          }
          return next;
        });
      })
      .catch((error) => toast.error(error?.message || 'No se pudo cargar el detalle del cliente.'))
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, drafts, wholesaler]);

  const toggleClient = (email) => {
    setSelected((prev) => (prev.includes(email) ? prev.filter((value) => value !== email) : [...prev, email]));
  };

  const updateDraft = (email, patch) => {
    setDrafts((prev) => ({ ...prev, [email]: { ...prev[email], ...patch } }));
  };

  const selectedDrafts = useMemo(() => {
    const map = {};
    for (const email of selected) {
      if (drafts[email]) map[email] = drafts[email];
    }
    return map;
  }, [selected, drafts]);

  const totals = useMemo(() => invoiceTotals(selectedDrafts), [selectedDrafts]);
  const currentGroup = groups.find((group) => group.key === wholesaler) || null;

  const handleEmit = async () => {
    const payloadClients = selected
      .filter((email) => selectedDrafts[email])
      .map((email) => {
        const draft = selectedDrafts[email];
        return {
          client_id: draft.client_id,
          client_email: draft.client_email,
          client_name: draft.client_name,
          shipping_mark: draft.shipping_mark,
          rate_per_bulto: Number(draft.rate_per_bulto) || 0,
          door_to_door_per_bulto: Number(draft.door_to_door_per_bulto) || 0,
          orders: draftOrders(draft).map((order) => ({
            order_number: order.order_number,
            cbm: order.cbm === '' ? null : Number(order.cbm) || 0,
            bultos: Number(order.bultos) || 0,
            is_new: !!order.is_new,
            tracking_numbers: order.picked || [],
          })),
        };
      })
      .filter((client) => client.orders.length);

    if (!payloadClients.length) {
      toast.info('Elige al menos un cliente con su orden para facturar.');
      return;
    }

    setEmitting(true);
    try {
      const response = await base44.functions.invoke('createWholesalerInvoice', {
        wholesaler_key: wholesaler,
        wholesaler_name: currentGroup?.name || '',
        clients: payloadClients,
        notes,
      });
      const data = response?.data || {};
      if (!data.ok) {
        toast.error(data.error || 'No se pudo emitir la factura.');
        return;
      }
      setResult(data);
      clearLot();
      toast.success(data.mensaje || 'Factura emitida.');
      await loadClients();
      await loadInvoices();
    } catch (error) {
      toast.error(error?.message || 'No se pudo emitir la factura.');
    } finally {
      setEmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-0 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Receipt className="h-4 w-4 text-primary" />
            Facturar a los clientes del mayorista
          </CardTitle>
          <CardDescription>
            Elige el mayorista y sus clientes, asigna o crea el N° de orden/envío de cada uno y emite una
            sola factura: el envío y la puerta a puerta se cobran por bulto y cada cliente recibe su parte por correo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={wholesaler} onValueChange={setWholesaler}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="Elige el mayorista" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.key} value={group.key}>
                    {group.name} · {group.clients} cliente(s)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => { loadGroups(); loadClients(); loadInvoices(); }}
              disabled={loading || !wholesaler}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Actualizar
            </Button>
          </div>

          <WholesalerBillingClientPicker
            clients={clients}
            selected={selected}
            onToggle={toggleClient}
            loading={loading}
          />
        </CardContent>
      </Card>

      {result && <WholesalerBillingResult result={result} />}

      {detailLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando órdenes y trackings de los clientes elegidos…
        </div>
      )}

      {Object.keys(selectedDrafts).length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            {selected.map((email) => selectedDrafts[email] && (
              <WholesalerBillingClientCard
                key={email}
                draft={selectedDrafts[email]}
                onChange={(patch) => updateDraft(email, patch)}
                onRemove={() => toggleClient(email)}
              />
            ))}
          </div>
          <div className="space-y-4">
            <WholesalerBillingSummary
              totals={totals}
              notes={notes}
              onNotesChange={setNotes}
              onEmit={handleEmit}
              emitting={emitting}
            />
          </div>
        </div>
      )}

      <WholesalerBillingHistory invoices={invoices} loading={historyLoading} />
    </div>
  );
}