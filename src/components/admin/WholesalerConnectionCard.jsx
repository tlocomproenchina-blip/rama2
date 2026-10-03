import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Link2 } from 'lucide-react';

// Las direcciones se arman con la dirección real de la app en la que se está
// viendo la tarjeta, para que en una copia clon apunten al clon y no a la original.
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
const ENDPOINT = `${ORIGIN}/functions/appServiceAccess`;
const FEED_ENDPOINT = `${ORIGIN}/functions/wholesalerClientsFeed`;
const RECEPTION_ENDPOINT = `${ORIGIN}/functions/wholesalerReceptionWebhook`;

const FEED_ANSWER = `{
  "ok": true,
  "total": 1,
  "clients": [
    {
      "email": "cliente@correo.com",
      "full_name": "Nombre del cliente",
      "cedula": "V-12345678",
      "whatsapp": "584120000000",
      "city": "Valencia",
      "state": "carabobo",
      "address": "Calle 1",
      "shipping_mark": "50001"
    }
  ]
}`;

const EXAMPLES = [
  {
    title: 'Consultar un tracking (solo lectura)',
    body: `{
  "action": "check_tracking",
  "tracking_number": "TLEC123456"
}`,
    answer: `{
  "encontrado": true,
  "estado": "recibido_en_china",
  "cliente": "Nombre del cliente",
  "shipping_mark": "50001",
  "recibido": true
}`,
  },
  {
    title: 'Avisar que su carga llegó al almacén de China',
    body: `{
  "action": "receive_tracking",
  "tracking_number": "TLEC123456",
  "client_email": "cliente@correo.com",
  "package_count": 3
}`,
    answer: `{
  "ok": true,
  "resultado": "recibido",
  "aviso": "pendiente"
}`,
  },
  {
    title: 'Reportar una pre-alerta a nombre de su cliente',
    body: `{
  "action": "report_prealert",
  "tracking_number": "TLEC123456",
  "client_email": "cliente@correo.com",
  "description": "Zapatos",
  "shipping_type": "maritimo"
}`,
    answer: `{
  "ok": true,
  "resultado": "reportada"
}`,
  },
];

export default function WholesalerConnectionCard() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const rows = await base44.entities.WholesalerSync.filter({ config_key: 'main' }, '-updated_date', 1);
        const found = Array.isArray(rows) ? rows[0] : rows?.items?.[0];
        setConfig(found || {
          config_key: 'main',
          wholesaler_name: 'Cliente mayorista',
          clients_feed_url: '',
          notify_url: '',
          intake_enabled: true,
          report_email_enabled: true,
          notify_enabled: true,
        });
      } catch (err) {
        toast.error('No se pudo cargar la conexión con el mayorista.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        config_key: 'main',
        wholesaler_name: config.wholesaler_name || 'Cliente mayorista',
        clients_feed_url: (config.clients_feed_url || '').trim(),
        notify_url: (config.notify_url || '').trim(),
        intake_enabled: !!config.intake_enabled,
        report_email_enabled: !!config.report_email_enabled,
        notify_enabled: !!config.notify_enabled,
      };
      const saved = config.id
        ? await base44.entities.WholesalerSync.update(config.id, payload)
        : await base44.entities.WholesalerSync.create(payload);
      setConfig({ ...config, ...(saved || payload) });
      toast.success('Conexión con el mayorista guardada.');
    } catch (err) {
      toast.error(err?.message || 'No se pudo guardar la conexión.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border bg-card p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 md:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Link2 className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Conexión con el mayorista</h3>
          <p className="text-sm text-muted-foreground">
            Cruce automático de clientes, pre-alertas y avisos de recepción con la app del cliente mayorista.
            Cada app guarda su propia clave (en Secretos), así solo puede ver y avisar sobre su propia carga.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Nombre del mayorista</Label>
          <Input
            value={config?.wholesaler_name || ''}
            onChange={(e) => setConfig({ ...config, wholesaler_name: e.target.value })}
            placeholder="Nombre que aparece en el panel y en el informe"
          />
        </div>
        <div className="space-y-2">
          <Label>Dirección para pedirle sus clientes nuevos</Label>
          <Input
            value={config?.clients_feed_url || ''}
            onChange={(e) => setConfig({ ...config, clients_feed_url: e.target.value })}
            placeholder="https://su-app.com/api/clientes-nuevos"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Dirección para avisarle que su carga llegó a China</Label>
          <Input
            value={config?.notify_url || ''}
            onChange={(e) => setConfig({ ...config, notify_url: e.target.value })}
            placeholder="https://su-app.com/api/recepciones"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl bg-muted/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Consultar clientes nuevos cada día</p>
            <p className="text-xs text-muted-foreground">Corte diario a las 8:00 a.m. (Caracas) con informe por correo.</p>
          </div>
          <Switch
            checked={!!config?.intake_enabled}
            onCheckedChange={(v) => setConfig({ ...config, intake_enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Enviar el informe diario por correo</p>
            <p className="text-xs text-muted-foreground">A los administradores, con el detalle en Excel.</p>
          </div>
          <Switch
            checked={!!config?.report_email_enabled}
            onCheckedChange={(v) => setConfig({ ...config, report_email_enabled: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Avisar al mayorista cada recepción</p>
            <p className="text-xs text-muted-foreground">Cuando su carga entra al almacén de China, se avisa a su app.</p>
          </div>
          <Switch
            checked={!!config?.notify_enabled}
            onCheckedChange={(v) => setConfig({ ...config, notify_enabled: v })}
          />
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar conexión
      </Button>

      <div className="space-y-3 border-t pt-4">
        <div>
          <p className="text-sm font-medium text-foreground">Dirección que le entregas a su app</p>
          <p className="mt-1 break-all rounded-lg bg-muted p-2 font-mono text-xs text-foreground">{ENDPOINT}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Va con la cabecera <span className="font-mono">x-api-key</span> usando la clave de la app del mayorista.
          </p>
        </div>

        <div className="rounded-lg border border-dashed p-3">
          <p className="text-sm font-medium text-foreground">Direcciones que esta app le entrega a la otra</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Con la misma cabecera <span className="font-mono">x-api-key</span> (cualquiera de las claves de la integración).
            Sirven para que la otra app pida aquí sus clientes nuevos y avise que la carga llegó a China.
          </p>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-foreground">Pedir los clientes nuevos (GET, admite ?since=fecha)</p>
              <p className="mt-1 break-all rounded bg-muted p-2 font-mono text-xs text-foreground">{FEED_ENDPOINT}</p>
              <pre className="mt-2 overflow-x-auto rounded bg-accent/60 p-2 text-[11px] leading-relaxed text-accent-foreground">{FEED_ANSWER}</pre>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-foreground">Avisar que la carga llegó a China (POST)</p>
              <p className="mt-1 break-all rounded bg-muted p-2 font-mono text-xs text-foreground">{RECEPTION_ENDPOINT}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recibe el mismo aviso que esta app envía al mayorista: queda en el historial de movimientos y los paquetes
                registrados se marcan como recibidos en China.
              </p>
            </div>
          </div>
        </div>

        {EXAMPLES.map((ex) => (
          <div key={ex.title} className="rounded-lg border p-3">
            <p className="text-xs font-semibold text-foreground">{ex.title}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <pre className="overflow-x-auto rounded bg-muted p-2 text-[11px] leading-relaxed text-foreground">{ex.body}</pre>
              <pre className="overflow-x-auto rounded bg-accent/60 p-2 text-[11px] leading-relaxed text-accent-foreground">{ex.answer}</pre>
            </div>
          </div>
        ))}

        <div className="rounded-lg border border-dashed p-3">
          <p className="text-xs font-semibold text-foreground">Lo que tu app recibe cuando su carga llega a China</p>
          <p className="mt-1 text-xs text-muted-foreground">Se envía a la dirección de aviso, con la misma cabecera de la clave:</p>
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-[11px] leading-relaxed text-foreground">{`{
  "event": "carga_recibida",
  "tracking_number": "TLEC123456",
  "client_email": "cliente@correo.com",
  "shipping_mark": "50001",
  "package_count": 3,
  "received_date": "2026-10-03T13:00:00.000Z"
}`}</pre>
        </div>
      </div>
    </div>
  );
}