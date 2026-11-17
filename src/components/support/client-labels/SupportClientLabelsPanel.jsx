import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Tag, Package, Boxes } from 'lucide-react';
import { downloadShippingLabelFile } from '@/lib/shippingLabelFile';
import { downloadBultoLabelsPdf } from '@/lib/bultoLabelPdf';
import { withContainerNumbers } from '@/lib/containerLookup';
import SupportLabelRow from './SupportLabelRow';
import SupportGenerateLabelDialog from './SupportGenerateLabelDialog';

function Group({ icon: Icon, title, count, children, empty }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">{title}</p>
        <Badge variant="secondary" className="ml-auto">{count}</Badge>
      </div>
      <div className="max-h-72 divide-y divide-border/60 overflow-y-auto">
        {count === 0 ? <p className="px-3 py-3 text-xs text-muted-foreground">{empty}</p> : children}
      </div>
    </div>
  );
}

// Etiquetas del cliente consultado: Shipping Mark, etiquetas de paquetes y de
// bultos/cajas. Soporte puede descargarlas o generar etiquetas nuevas.
export default function SupportClientLabelsPanel({ client }) {
  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState([]);
  const [packages, setPackages] = useState([]);
  const [bultos, setBultos] = useState([]);
  const [config, setConfig] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    const email = client?.email;
    if (!email) return;
    setLoading(true);
    const [l, p, b, c] = await Promise.allSettled([
      base44.entities.ShippingLabel.filter({ client_email: email }, '-created_date', 200),
      base44.entities.Package.filter({ client_email: email }, '-created_date', 200),
      base44.entities.Bulto.filter({ client_email: email }, '-created_date', 200),
      base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1),
    ]);
    setLabels(l.status === 'fulfilled' ? l.value : []);
    setPackages(p.status === 'fulfilled' ? p.value : []);
    setBultos(b.status === 'fulfilled' ? b.value : []);
    setConfig(c.status === 'fulfilled' ? c.value?.[0] || null : null);
    setLoading(false);
  }, [client?.email]);

  useEffect(() => { load(); }, [load]);

  const trackingFor = (label) => {
    const pkg = packages.find((p) => p.id === label.linked_package_id);
    return pkg?.tracking_number && pkg.tracking_number !== label.label_code ? pkg.tracking_number : '';
  };

  const downloadBulto = async (bulto) => {
    await downloadBultoLabelsPdf(await withContainerNumbers([bulto]));
  };

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-primary" /> Etiquetas del cliente
          </CardTitle>
          <Button size="sm" onClick={() => setDialogOpen(true)} disabled={!client?.shipping_mark}>
            <Plus className="mr-1 h-4 w-4" /> Generar etiqueta
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Shipping Mark:</span>
          {client?.shipping_mark
            ? <span className="rounded-lg bg-accent px-2 py-0.5 font-mono font-bold text-accent-foreground">{client.shipping_mark}</span>
            : <Badge variant="outline" className="border-warning/30 bg-warning-bg text-warning">Sin Shipping Mark asignado</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <Group icon={Package} title="Etiquetas de paquetes" count={labels.length} empty="Este cliente aún no tiene etiquetas de paquetes.">
              {labels.map((label) => (
                <SupportLabelRow
                  key={label.id}
                  code={label.label_code}
                  title={label.content || 'Sin contenido'}
                  subtitle={trackingFor(label) ? `Tracking ${trackingFor(label)}` : 'Sin tracking'}
                  badge={Number(label.box_count) > 1 ? `${label.box_count} cajas` : null}
                  onDownload={() => downloadShippingLabelFile(label, config)}
                />
              ))}
            </Group>
            <Group icon={Boxes} title="Etiquetas de bultos y cajas" count={bultos.length} empty="Este cliente aún no tiene bultos ni cajas.">
              {bultos.map((bulto) => (
                <SupportLabelRow
                  key={bulto.id}
                  code={bulto.label_code}
                  title={bulto.is_caja
                    ? `Caja ${bulto.caja_number || 1}/${bulto.caja_total || 1}`
                    : `Bulto ${bulto.bulto_number || 1}/${bulto.total_bultos || 1}`}
                  subtitle={`${bulto.cargo_package_count ?? (bulto.package_ids || []).length} paquete(s)`}
                  badge={bulto.is_caja ? 'Caja' : 'Bulto'}
                  onDownload={() => downloadBulto(bulto)}
                />
              ))}
            </Group>
          </>
        )}
      </CardContent>
      <SupportGenerateLabelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientEmail={client?.email}
        config={config}
        onCreated={load}
      />
    </Card>
  );
}