import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus } from 'lucide-react';
import WholesalerConnectionsPanel from '@/components/wholesaler/WholesalerConnectionsPanel';
import WholesalerActionsBar from '@/components/wholesaler/WholesalerActionsBar';
import WholesalerStatusCards from '@/components/wholesaler/WholesalerStatusCards';
import WholesalerClientsTable from '@/components/wholesaler/WholesalerClientsTable';
import WholesalerMovementsList from '@/components/wholesaler/WholesalerMovementsList';
import DeleteWholesalerConfirmDialog from '@/components/wholesaler/DeleteWholesalerConfirmDialog';

const RANGES = [
  { key: 'hoy', label: 'Hoy', hours: 24 },
  { key: '7', label: '7 días', hours: 24 * 7 },
  { key: '30', label: '30 días', hours: 24 * 30 },
  { key: 'todos', label: 'Todos', hours: 0 },
];

function connKeyOf(connection) {
  return connection?.config_key || 'main';
}

function toArray(rows) {
  return Array.isArray(rows) ? rows : rows?.items || [];
}

// Filtro por mayorista: con uno elegido se ve solo su carga. La conexión
// principal (la de siempre) también muestra lo traído antes de admitir varios
// mayoristas, que quedó sin marca de origen.
function connectionScope(connection, connections) {
  if (!connection) return {};
  const key = connKeyOf(connection);
  const others = connections
    .filter((c) => c.id !== connection.id)
    .map((c) => c.config_key)
    .filter((k) => k && k !== key);
  if (!others.length) return {};
  if (connections[0]?.id === connection.id) return { wholesaler_key: { $nin: others } };
  return { wholesaler_key: key };
}

export default function AdminWholesalerClients() {
  const [connections, setConnections] = useState([]);
  const [clients, setClients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [range, setRange] = useState('7');
  const [tab, setTab] = useState('clientes');
  const [wholesaler, setWholesaler] = useState('todos');
  const [deletingClient, setDeletingClient] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const rangeHours = RANGES.find((r) => r.key === range)?.hours || 0;
    const since = rangeHours ? new Date(Date.now() - rangeHours * 3600 * 1000).toISOString() : null;
    const dateFilter = since ? { $gte: since } : undefined;

    const connRows = await base44.entities.WholesalerSync.list('created_date', 50);
    const list = toArray(connRows);
    setConnections(list);

    const selected = list.find((c) => connKeyOf(c) === wholesaler) || null;
    const scope = connectionScope(selected, list);
    const clientDate = dateFilter ? { fetched_date: dateFilter } : {};
    const logDate = dateFilter ? { event_date: dateFilter } : {};

    const [clientRows, logRows, creados, pendientes, existentes, errores, recepciones] = await Promise.all([
      base44.entities.WholesalerClient.filter({ ...clientDate, ...scope }, '-fetched_date', 50),
      base44.entities.WholesalerLog.filter({ ...logDate, ...scope }, '-event_date', 50),
      base44.entities.WholesalerClient.count({ status: 'creado', ...clientDate, ...scope }),
      base44.entities.WholesalerClient.count({ status: 'pendiente', ...scope }),
      base44.entities.WholesalerClient.count({ status: 'existente', ...clientDate, ...scope }),
      base44.entities.WholesalerClient.count({ status: 'error', ...clientDate, ...scope }),
      base44.entities.WholesalerLog.count({ event_type: 'recepcion', ...logDate, ...scope }),
    ]);

    setClients(toArray(clientRows));
    setLogs(toArray(logRows));
    setCounts({ creados, pendientes, existentes, errores, recepciones });
    setLoading(false);
  }, [range, wholesaler]);

  useEffect(() => { load(); }, [load]);

  const selectedConnection = connections.find((c) => connKeyOf(c) === wholesaler) || null;
  const selectedName = selectedConnection?.wholesaler_name || 'Cliente mayorista';

  const handleSync = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('syncWholesalerClients', {});
      const data = res?.data || {};
      if (data.error) toast.error(data.error);
      else toast.success(data.mensaje || 'Consulta terminada.');
      await load();
    } catch (err) {
      toast.error(err?.message || 'No se pudo consultar las apps de los mayoristas.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    try {
      const payload = selectedConnection?.id ? { connection_id: selectedConnection.id } : {};
      const res = await base44.functions.invoke('sendWholesalerReport', payload);
      const data = res?.data || {};
      if (data.enviado) toast.success(data.mensaje || 'Informe enviado a los administradores.');
      else toast.info(data.mensaje || 'No había clientes nuevos por reportar.');
      await load();
    } catch (err) {
      toast.error(err?.message || 'No se pudo enviar el informe.');
    } finally {
      setBusy(false);
    }
  };

  // Las cuentas se crean aquí (sesión de admin): invitación, datos y Shipping Mark.
  const handleCreateAccounts = async () => {
    const scope = connectionScope(selectedConnection, connections);
    const res = await base44.entities.WholesalerClient.filter({ status: 'pendiente', ...scope }, '-fetched_date', 50);
    const rows = toArray(res);
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

  const handleDeleteClient = async () => {
    try {
      await base44.entities.WholesalerClient.delete(deletingClient.id);
      toast.success('Cliente eliminado de la lista del mayorista.');
      setDeletingClient(null);
      await load();
    } catch (err) {
      toast.error(err?.message || 'No se pudo eliminar el cliente.');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Clientes del mayorista</h1>
        <p className="text-sm text-muted-foreground">
          Cruce diario con las apps de los clientes mayoristas: clientes nuevos, pre-alertas y avisos de recepción.
        </p>
      </div>

      <WholesalerConnectionsPanel connections={connections} loading={loading} onRefresh={load} />

      <WholesalerActionsBar connections={connections} busy={busy} onSync={handleSync} onResend={handleResend} />

      <WholesalerStatusCards counts={counts} loading={loading} />

      {(counts.pendientes || 0) > 0 && (
        <Card className="rounded-2xl border-0 shadow-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-foreground">
              <strong>{counts.pendientes}</strong> cliente(s) traídos del mayorista
              {selectedConnection ? ` ${selectedName}` : ''} esperan su cuenta en TLEC CARGO.
              Las cuentas se crean con un clic desde aquí (la app envía la invitación al cliente y le asigna su Shipping Mark).
            </p>
            <Button onClick={handleCreateAccounts} disabled={creating} className="gap-2">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Crear cuentas
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={wholesaler} onValueChange={setWholesaler}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Todos los mayoristas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los mayoristas</SelectItem>
            {connections.map((connection) => (
              <SelectItem key={connection.id} value={connKeyOf(connection)}>
                {connection.wholesaler_name || 'Cliente mayorista'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-3">
          <WholesalerClientsTable clients={clients} loading={loading} onDelete={setDeletingClient} />
        </TabsContent>

        <TabsContent value="movimientos">
          <WholesalerMovementsList logs={logs} loading={loading} />
        </TabsContent>
      </Tabs>

      <DeleteWholesalerConfirmDialog
        open={!!deletingClient}
        onOpenChange={(open) => { if (!open) setDeletingClient(null); }}
        title={`Eliminar el cliente ${deletingClient?.full_name || deletingClient?.email || ''}`}
        description="Se borra este registro de la lista de clientes traídos del mayorista. La cuenta del cliente en TLEC CARGO, sus paquetes y sus facturas no se tocan."
        onConfirm={handleDeleteClient}
      />
    </div>
  );
}