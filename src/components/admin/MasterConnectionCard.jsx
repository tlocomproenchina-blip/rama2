import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plug, Loader2, RefreshCw, Copy, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const MASTER_ENDPOINT = 'https://tleccargo.base44.app/functions/integratedAppApi';

function badgeOf(state) {
  if (!state.configured) {
    return { label: 'Sin configurar', tone: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  if (state.pending > 0) {
    return { label: `${state.pending} envío${state.pending === 1 ? '' : 's'} pendiente${state.pending === 1 ? '' : 's'}`, tone: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  if (state.last_verified) {
    return { label: 'Conectada', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  return { label: 'Configurada, sin verificar', tone: 'bg-slate-100 text-slate-600 border-slate-200' };
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MasterConnectionCard() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      const { data } = await base44.functions.invoke('masterBridge', { action: 'status' });
      setState(data || null);
    } catch (error) {
      setState(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data } = await base44.functions.invoke('masterBridge', { action: 'test' });
      if (data?.ok) toast.success(data.message || 'Conexión verificada');
      else toast.error(data?.message || 'No se pudo conectar con TLEC CARGO');
    } catch (error) {
      toast.error('No se pudo conectar con TLEC CARGO');
    }
    setTesting(false);
    load();
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const { data } = await base44.functions.invoke('masterBridge', { action: 'retry' });
      if (data?.ok) {
        const sent = data.summary?.sent || 0;
        const failed = data.summary?.failed || 0;
        if (sent > 0 && failed === 0) toast.success(`${sent} envío${sent === 1 ? '' : 's'} entregado${sent === 1 ? '' : 's'} a TLEC CARGO`);
        else if (sent > 0) toast.warning(`${sent} enviado(s), ${failed} con error. Revisa el motivo abajo.`);
        else toast.error('No se pudo entregar nada todavía');
      } else {
        toast.error(data?.message || 'No se pudo reintentar');
      }
    } catch (error) {
      toast.error('No se pudo reintentar los envíos');
    }
    setRetrying(false);
    load();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state?.endpoint || MASTER_ENDPOINT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('No se pudo copiar');
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 bg-card rounded-xl border border-border/70 shadow-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Revisando la conexión con TLEC CARGO...
        </div>
      </div>
    );
  }

  // En la app maestra no aplica: aquí no se conecta a otra instancia.
  if (!state?.ok || state?.is_master) return null;

  const badge = badgeOf(state);

  return (
    <Card className="rounded-2xl border border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plug className="h-5 w-5 text-primary" />
              Conexión con TLEC CARGO
            </CardTitle>
            <CardDescription>
              Envía a la maestra los clientes registrados y las pre-alertas creadas en esta app.
            </CardDescription>
          </div>
          <Badge variant="outline" className={`shrink-0 ${badge.tone}`}>{badge.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 md:p-6 md:pt-0">
        {!state.configured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Falta guardar {state.missing.join(' y ')} en la página de Secretos. Los nombres admitidos usan solo mayúsculas,
                números y guion bajo, así que el código acepta el nombre con acento y también su variante sin acento.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-amber-900">Dirección del servicio</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <code className="flex-1 min-w-0 rounded-lg border border-amber-200 bg-card px-3 py-2 text-xs break-all">{MASTER_ENDPOINT}</code>
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 shrink-0">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copiada' : 'Copiar'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {state.configured && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Estado</span>
              <span className="font-medium text-foreground">{badge.label}</span>
            </div>
            {state.master_name && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Registrada como</span>
                <span className="font-medium text-foreground">{state.master_name}</span>
              </div>
            )}
            {state.last_verified && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Última verificación</span>
                <span className="font-medium text-foreground">{formatDate(state.last_verified)}</span>
              </div>
            )}
            {state.last_sent && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Último envío aceptado</span>
                <span className="font-medium text-foreground">
                  {state.last_sent_label || 'Registro'} · {formatDate(state.last_sent)}
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Dirección</span>
              <span className="font-mono text-xs break-all text-foreground">{state.endpoint}</span>
            </div>
          </div>
        )}

        {state.pending > 0 && state.last_error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
            <p className="text-sm font-medium text-amber-900">
              Último motivo ({state.last_error_label || 'envío'}{state.last_error_date ? ` · ${formatDate(state.last_error_date)}` : ''})
            </p>
            <p className="text-sm text-amber-800 break-words">{state.last_error}</p>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={handleTest} disabled={testing || retrying} className="gap-2 w-full sm:w-auto">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            Probar conexión
          </Button>
          {state.pending > 0 && (
            <Button variant="outline" onClick={handleRetry} disabled={testing || retrying} className="gap-2 w-full sm:w-auto">
              {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Reintentar {state.pending} pendiente{state.pending === 1 ? '' : 's'}
            </Button>
          )}
        </div>

        <p className="text-xs text-slate-500">
          Los envíos que no lleguen se reintentan solos cada 15 minutos; la operación del cliente nunca se interrumpe.
        </p>
      </CardContent>
    </Card>
  );
}