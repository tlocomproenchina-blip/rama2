import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';

const EMPTY = {
  wholesaler_name: '',
  clients_feed_url: '',
  notify_url: '',
  inbound_key: '',
  outbound_key: '',
  intake_enabled: true,
  report_email_enabled: true,
  notify_enabled: true,
};

function newConnectionKey() {
  return `ws-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Alta y edición de la conexión con un mayorista: su nombre, sus dos direcciones
// y sus dos claves (la que él usa para llamarnos y la que usamos para llamarlo).
export default function WholesalerConnectionDialog({ open, connection, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(connection?.id ? { ...EMPTY, ...connection } : { ...EMPTY });
  }, [open, connection]);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    const name = String(form.wholesaler_name || '').trim();
    if (!name) {
      toast.error('Ponle nombre al mayorista.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        config_key: connection?.id ? (connection.config_key || 'main') : newConnectionKey(),
        wholesaler_name: name,
        clients_feed_url: String(form.clients_feed_url || '').trim(),
        notify_url: String(form.notify_url || '').trim(),
        inbound_key: String(form.inbound_key || '').trim(),
        outbound_key: String(form.outbound_key || '').trim(),
        intake_enabled: !!form.intake_enabled,
        report_email_enabled: !!form.report_email_enabled,
        notify_enabled: !!form.notify_enabled,
      };

      if (connection?.id) await base44.entities.WholesalerSync.update(connection.id, payload);
      else await base44.entities.WholesalerSync.create(payload);

      toast.success(connection?.id ? 'Conexión actualizada.' : 'Conexión agregada.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.message || 'No se pudo guardar la conexión.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{connection?.id ? 'Editar conexión' : 'Agregar conexión'}</DialogTitle>
          <DialogDescription>
            Cada mayorista usa sus propias direcciones y claves. Con ellas se le piden sus clientes nuevos y se le avisa
            cuando su carga llega al almacén de China.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre del mayorista</Label>
            <Input
              value={form.wholesaler_name || ''}
              onChange={(e) => set({ wholesaler_name: e.target.value })}
              placeholder="Aparece en el panel, en los avisos y en el informe"
            />
          </div>

          <div className="space-y-2">
            <Label>Dirección para pedirle sus clientes nuevos</Label>
            <Input
              value={form.clients_feed_url || ''}
              onChange={(e) => set({ clients_feed_url: e.target.value })}
              placeholder="https://su-app.com/functions/wholesalerClientsFeed"
            />
          </div>

          <div className="space-y-2">
            <Label>Dirección para avisarle que su carga llegó a China</Label>
            <Input
              value={form.notify_url || ''}
              onChange={(e) => set({ notify_url: e.target.value })}
              placeholder="https://su-app.com/functions/wholesalerReceptionWebhook"
            />
            <p className="text-xs text-muted-foreground">
              Ese aviso va con las direcciones públicas de las fotos del paquete, listas para mostrar en su app.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Clave con la que ese mayorista llama a esta app</Label>
            <Input
              value={form.inbound_key || ''}
              onChange={(e) => set({ inbound_key: e.target.value })}
              placeholder="Vacío: usa la clave de Secretos"
            />
            <p className="text-xs text-muted-foreground">
              Es con la que su app consulta trackings, recepciona y reporta pre-alertas aquí.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Clave con la que esta app llama a ese mayorista</Label>
            <Input
              value={form.outbound_key || ''}
              onChange={(e) => set({ outbound_key: e.target.value })}
              placeholder="Vacío: usa la clave de Secretos"
            />
            <p className="text-xs text-muted-foreground">
              Es la que viaja cuando le pedimos sus clientes y cuando le avisamos una recepción.
            </p>
          </div>

          <div className="space-y-3 rounded-xl bg-muted/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Consultar sus clientes nuevos cada día</p>
                <p className="text-xs text-muted-foreground">Corte diario a las 8:00 a.m. (Caracas).</p>
              </div>
              <Switch checked={!!form.intake_enabled} onCheckedChange={(v) => set({ intake_enabled: v })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Enviar el informe diario por correo</p>
                <p className="text-xs text-muted-foreground">A los administradores, con el detalle en Excel.</p>
              </div>
              <Switch checked={!!form.report_email_enabled} onCheckedChange={(v) => set({ report_email_enabled: v })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Avisarle cada recepción</p>
                <p className="text-xs text-muted-foreground">Cuando su carga entra al almacén de China.</p>
              </div>
              <Switch checked={!!form.notify_enabled} onCheckedChange={(v) => set({ notify_enabled: v })} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar conexión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}