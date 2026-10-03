import React from 'react';
import moment from 'moment';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Pencil, PlugZap, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';

const STATES = {
  conectado: { label: 'Conectado', tone: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', Icon: CheckCircle2 },
  error: { label: 'Con problema', tone: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500', Icon: AlertTriangle },
  sin_probar: { label: 'Sin probar', tone: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', Icon: HelpCircle },
};

function when(value) {
  if (!value) return 'nunca';
  try {
    return moment(value).format('DD/MM/YYYY HH:mm');
  } catch (_) {
    return 'nunca';
  }
}

function maskKey(key) {
  const value = String(key || '').trim();
  if (!value) return 'clave de Secretos';
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`;
}

// Tarjeta de un mayorista: cómo está su conexión, cuándo se verificó, qué trajo,
// sus claves enmascaradas y su botón de prueba.
export default function WholesalerConnectionStatusCard({ connection, probing, onProbe, onEdit }) {
  const state = STATES[connection?.connection_status] || STATES.sin_probar;
  const Icon = state.Icon;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${state.dot}`} />
            <h3 className="truncate font-display text-base font-semibold text-foreground">
              {connection?.wholesaler_name || 'Cliente mayorista'}
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Verificado: {when(connection?.connection_checked_date)}
            {(Number(connection?.connection_clients_count) || 0) > 0 && ` · ${connection.connection_clients_count} cliente(s)`}
          </p>
        </div>
        <Badge className={state.tone}>
          <Icon className="mr-1 h-3 w-3" />
          {state.label}
        </Badge>
      </div>

      {connection?.connection_message && (
        <p className={`text-xs ${connection?.connection_status === 'error' ? 'text-rose-600' : 'text-muted-foreground'}`}>
          {connection.connection_message}
        </p>
      )}

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Última consulta: {when(connection?.last_run_date)}</p>
        {connection?.last_run_message && <p className="text-foreground/80">{connection.last_run_message}</p>}
        {(Number(connection?.pending_notifications) || 0) > 0 && (
          <p className="text-amber-600">{connection.pending_notifications} aviso(s) pendiente(s) por entregar</p>
        )}
        <p className="font-mono">
          Claves: entra {maskKey(connection?.inbound_key)} · sale {maskKey(connection?.outbound_key)}
        </p>
        <p className="truncate">
          Clientes: {connection?.clients_feed_url ? 'dirección configurada' : 'falta la dirección de sus clientes'}
        </p>
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onProbe(connection)} disabled={probing} className="gap-2">
          {probing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
          Probar conexión
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onEdit(connection)} className="gap-2">
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
      </div>
    </div>
  );
}