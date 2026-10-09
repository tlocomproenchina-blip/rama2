import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Send } from 'lucide-react';
import WholesalerOutboundStats from './WholesalerOutboundStats';
import WholesalerShipmentSearch from './WholesalerShipmentSearch';
import WholesalerShipmentHistory from './WholesalerShipmentHistory';

// Pestaña «Envíos»: qué se le está mandando a la app de cada mayorista (el
// tracking y las fotos de cada carga recibida), el estado por paquete y el
// reenvío de lo que quedó pendiente o fallido.
export default function WholesalerOutboundPanel({ shipments = [], counts = {}, loading, connectionId, onResent }) {
  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="space-y-3 p-4">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <Send className="h-4 w-4 text-primary" />
              Qué se envía al mayorista
            </h3>
            <p className="text-sm text-muted-foreground">
              Cada carga recibida en China se avisa a la app del mayorista con su tracking y sus fotos.
              Aquí ves qué salió, qué quedó pendiente o fallido y puedes reintentarlo.
            </p>
          </div>
          <WholesalerOutboundStats counts={counts} loading={loading} />
        </CardContent>
      </Card>

      <WholesalerShipmentSearch connectionId={connectionId} onResent={onResent} />

      <div className="space-y-2">
        <h3 className="font-display text-lg font-semibold text-foreground">Historial de envíos</h3>
        <WholesalerShipmentHistory shipments={shipments} loading={loading} onResent={onResent} />
      </div>
    </div>
  );
}