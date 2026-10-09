import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import WholesalerOutboundStats from './WholesalerOutboundStats';
import WholesalerShipmentSearch from './WholesalerShipmentSearch';
import WholesalerShipmentHistory from './WholesalerShipmentHistory';
import WholesalerClientSummary from './WholesalerClientSummary';

// Pestaña «Envíos»: qué se le está mandando a la app de cada mayorista (el
// tracking y las fotos de cada carga recibida), el estado por tracking, el
// reenvío de lo que quedó pendiente o fallido y el resumen por cliente.
export default function WholesalerOutboundPanel({ shipments = [], clients = [], counts = {}, loading, connectionId, onResent }) {
  const [view, setView] = useState('historial');

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

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={view === 'historial' ? 'default' : 'outline'}
          onClick={() => setView('historial')}
        >
          Historial de envíos
        </Button>
        <Button
          size="sm"
          variant={view === 'clientes' ? 'default' : 'outline'}
          onClick={() => setView('clientes')}
        >
          Resumen por cliente
        </Button>
      </div>

      {view === 'historial' ? (
        <div className="space-y-2">
          <h3 className="font-display text-lg font-semibold text-foreground">Historial de envíos</h3>
          <WholesalerShipmentHistory shipments={shipments} loading={loading} onResent={onResent} />
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="font-display text-lg font-semibold text-foreground">Resumen por cliente</h3>
          <p className="text-sm text-muted-foreground">
            Cada cliente traído del mayorista con su carga: tracking por tracking, si el aviso ya salió a su app,
            si quedó pendiente o fallido, o si todavía no se le ha avisado nada.
          </p>
          <WholesalerClientSummary clients={clients} loading={loading} onResent={onResent} />
        </div>
      )}
    </div>
  );
}