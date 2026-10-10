import React, { useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PenSquare } from 'lucide-react';
import ManualGuideScannedTab from './ManualGuideScannedTab';
import GuideFromOrdersTab from './GuideFromOrdersTab';
import GuideFromInvoicesTab from './GuideFromInvoicesTab';

// Emisión manual de una guía por tres vías:
//   · por N° de orden / envío, aunque la carga no tenga bulto registrado;
//   · desde una factura pagada, eligiendo sus órdenes / envíos;
//   · eligiendo a mano los bultos escaneados que siguen pendientes.
// Al emitir se guarda la guía numerada y se genera sola la orden de despacho de cada
// cliente, más el PDF de la guía para imprimir.
export default function ManualGuideCard({ onGenerated }) {
  const [appName, setAppName] = useState('TLEC CARGO');

  useEffect(() => {
    base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1)
      .then((rows) => {
        if (rows?.[0]?.app_name) setAppName(rows[0].app_name);
      })
      .catch(() => {});
  }, []);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-2xl bg-primary/10 p-2 text-primary">
            <PenSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-foreground">Emisión manual de guía</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Emite la guía por N° de orden / envío o desde una factura pagada aunque el bulto no esté
              registrado, o elige a mano los bultos escaneados. Se guarda la guía numerada y se genera sola
              la orden de despacho de cada cliente.
            </p>
          </div>
        </div>

        <Tabs defaultValue="orders" className="space-y-3">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="orders">Orden / envío</TabsTrigger>
            <TabsTrigger value="invoices">Factura pagada</TabsTrigger>
            <TabsTrigger value="bultos">Bultos escaneados</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-0">
            <GuideFromOrdersTab appName={appName} onGenerated={onGenerated} />
          </TabsContent>
          <TabsContent value="invoices" className="mt-0">
            <GuideFromInvoicesTab appName={appName} onGenerated={onGenerated} />
          </TabsContent>
          <TabsContent value="bultos" className="mt-0">
            <ManualGuideScannedTab appName={appName} onGenerated={onGenerated} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}