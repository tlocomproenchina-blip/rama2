import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, UserPlus } from 'lucide-react';
import WholesalerActionsBar from '@/components/wholesaler/WholesalerActionsBar';
import WholesalerStatusCards from '@/components/wholesaler/WholesalerStatusCards';
import WholesalerClientsTable from '@/components/wholesaler/WholesalerClientsTable';
import WholesalerMovementsList from '@/components/wholesaler/WholesalerMovementsList';

const RANGES = [
  { key: 'hoy', label: 'Hoy', hours: 24 },
  { key: '7', label: '7 días', hours: 24 * 7 },
  { key: '30', label: '30 días', hours: 24 * 30 },
  { key: 'todos', label: 'Todos', hours: 0 },
];

export default function AdminWholesalerClients() {
  const [config, setConfig] = useState(null);
  const [clients, setClients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [range, setRange] = useState('7');
  const [tab, setTab] = useState('clientes');

  const load = useCallback(async () => {
    setLoading(true);
    const rangeHours = RANGES.find((r) => r.key === range)?.hours || 0;
    const since = rangeHours ? new Date(Date.now() - rangeHours * 3600 * 1000).toISOString() : null;
    const dateFilter = since ? { $gte: since } : undefined;

    const [cfg, clientRows, logRows, creados, pendientes, existentes, errores, recepciones] = await Promise.all([
      base44.entities.WholesalerSync.filter({ config_key: 'main' }, '-updated_date', 1),
      base44.entities.WholesalerClient.filter(
        dateFilter ? { fetched_date: dateFilter } : {},
        '-fetched_date',
        50,
      ),
      base44.entities.WholesalerLog.filter(dateFilter ? { event_date: dateFilter } : {}, '-event_date', 50),
      base44.entities.WholesalerClient.count({ status: 'creado', ...(dateFilter ? { fetched_date: dateFilter } : {}) }),
      base44.entities.WholesalerClient.count({ status: 'pendiente' }),
      base44.entities.WholesalerClient.count({ status: 'existente', ...(dateFilter ? { fetched_date: dateFilter } : {}) }),
      base44.entities.WholesalerClient.count({ status: 'error', ...(dateFilter ? { fetched_date: dateFilter } : {}) }),
      base44.entities.WholesalerLog.count({ event_type: 'recepcion', ...(dateFilter ? { event_date: dateFilter } : {}) }),
    ]);

    setConfig(Array.isArray(cfg) ? (cfg[0] || null) : cfg?.items?.[0] || null);
    setClients(Array.isArray(clientRows) ? clientRows : clientRows?.items || []);
    setLogs(Array.isArray(logRows) ? logRows : logRows?.items || []);
    setCounts({ creados, pendientes, existentes, errores, recepciones });
    setLoading(false);
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('syncWholesalerClients', {});
      const data = res?.data || {};
      if (data.error) toast.error(data.error);
      else toast.success(data.mensaje || 'Consulta terminada.');
      await load();
    } catch (err) {
      toast.error(err?.message || 'No se pudo consultar la app del mayorista.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('sendWholesalerReport', {});
      const data = res?.data || {};
      if (data.enviado) toast.success('Informe enviado a los administradores.');
      else toast.info(data.mensaje || 'No había clientes nuevos por reportar.');
      await load();
    } catch (err) {
      toast.error(err?.message || 'No se pudo enviar el informe.');
    } finally {
      setBusy(false);
    }
  };

  // La cuenta se crea aquí (sesión de admin): invitación, datos y Shipping Mark.
  const handleCreateAccounts = async () => {
    const res = await base44.entities.WholesalerClient.filter({ status: 'pendiente' }, '-fetched_date', 50);
    const rows = Array.isArray(res) ? res : res?.items || [];
    if (!rows.length) { toast.info('No hay clientes pendientes de crear.'); return; }

    setCreating(true);
    let created = 0, failed = 0, pendingUser = 0;

    for (const row of rows) {
      try {
        await base44.users.inviteUser(row.email, 'user');
        const lookup = await base44.functions.invoke('listAllUsers', { emails: [row.email] });
        const invited = lookup?.data?.users?.[0] || null;
        if (!invited?.id) { pendingUser += 1; continue; }

        await base44.entities.User.update(invited.id, {
          first_name: row.first_name || '',
          last_name: row.last_name || '',
          full_name: row.full_name || '',
          cedula: row.cedula || '',
          whatsapp: row.whatsapp || '',
          city: row.city || '',
          state: row.state || '',
          address: row.address || '',
          profile_completed: true,
        });

        let mark = row.shipping_mark || '';
        try {
          const gm = await base44.functions.invoke('generateShippingMark', { user_id: invited.id });
          mark = gm?.data?.shipping_mark || mark;
        } catch (_) {}

        await base44.functions.invoke('completeWholesalerClient', { client_id: row.id, shipping_mark: mark });
        created += 1;
      } catch (_) {
        failed += 1;
      }
    }

    setCreating(false);
    if (created) toast.success(`${created} cuenta(s) creada(s) con su Shipping Mark.`);
    if (pendingUser) toast.warning(`${pendingUser} cliente(s) quedaron invitados: reintenta en unos minutos para cerrar sus datos.`);
    if (failed) toast.error(`${failed} cliente(s) no se pudieron crear.`);
    await load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Clientes del mayorista</h1>
        <p className="text-sm text-muted-foreground">
          Cruce diario con la app del cliente mayorista: clientes nuevos, pre-alertas y avisos de recepción.
        </p>
      </div>

      <WholesalerActionsBar config={config} busy={busy} onSync={handleSync} onResend={handleResend} />

      <WholesalerStatusCards counts={counts} loading={loading} />

      {(counts.pendientes || 0) > 0 && (
        <Card className="rounded-2xl border-0 shadow-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-foreground">
              <strong>{counts.pendientes}</strong> cliente(s) traídos del mayorista esperan su cuenta en TLEC CARGO.
              Las cuentas se crean con un clic desde aquí (la app envía la invitación al cliente y le asigna su Shipping Mark).
            </p>
            <Button onClick={handleCreateAccounts} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Crear cuentas
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <Button
                key={r.key}
                size="sm"
                variant={range === r.key ? 'default' : 'outline'}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          <WholesalerClientsTable clients={clients} loading={loading} />
        </TabsContent>

        <TabsContent value="movimientos">
          <WholesalerMovementsList logs={logs} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}