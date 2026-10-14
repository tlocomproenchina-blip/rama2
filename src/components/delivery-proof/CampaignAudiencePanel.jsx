import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Users, Package, MailCheck, Loader2 } from 'lucide-react';

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 font-display text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}

export default function CampaignAudiencePanel({ totals, sample, loading, excludeNotified, onToggleExclude }) {
  const clients = sample || [];

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Users className="h-4 w-4 text-primary" /> Clientes que recibirán el correo
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric icon={Users} label="Clientes" value={totals?.targets ?? 0} />
          <Metric icon={Package} label="Cargas pre-alertadas" value={totals?.packages ?? 0} />
        </div>

        {totals?.notified > 0 ? (
          <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card p-3">
            <Checkbox
              id="exclude-notified"
              checked={excludeNotified}
              onCheckedChange={(value) => onToggleExclude(value === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="exclude-notified" className="cursor-pointer text-sm font-medium">
                No repetir el correo a quienes ya se les envió
              </Label>
              <p className="text-xs text-muted-foreground">
                {totals.notified} de {totals.eligible} clientes ya recibieron esta campaña. Si desmarcas, se les vuelve a enviar.
              </p>
            </div>
          </div>
        ) : null}

        {clients.length ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primeros clientes</span>
              <Badge variant="outline" className="text-xs">
                <MailCheck className="mr-1 h-3 w-3" /> {totals?.targets ?? 0} en total
              </Badge>
            </div>
            <div className="max-h-64 divide-y divide-border/60 overflow-y-auto rounded-2xl border border-border/70">
              {clients.map((client) => (
                <div key={client.email} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{client.client_name || client.email}</div>
                    <div className="truncate text-xs text-muted-foreground">{client.email}</div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {client.count} {client.count === 1 ? 'carga' : 'cargas'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No hay clientes con cargas pre-alertadas en los últimos 30 días.
          </p>
        )}
      </CardContent>
    </Card>
  );
}