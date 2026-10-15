import React from 'react';
import { Loader2, Phone, User, Wallet, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AssistantHistoryList from '@/components/support/assistant/AssistantHistoryList';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const cbm = (value) => `${Number(value || 0).toFixed(3)} CBM`;

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl bg-muted/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

// Perfil e historial completo del cliente elegido: es el respaldo con el que el
// asistente responde y lo que el ATC tiene a la vista mientras atiende.
export default function AssistantClientPanel({ client, context, loading }) {
  if (!client) return null;

  if (loading || !context) {
    return (
      <Card className="border-border/70 shadow-card">
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando el historial del cliente…
        </CardContent>
      </Card>
    );
  }

  const { cliente, resumen } = context;
  const whatsappDigits = String(cliente.whatsapp || '').replace(/\D/g, '');

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-primary" /> {cliente.nombre}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {cliente.shipping_mark ? <Badge variant="secondary">{cliente.shipping_mark}</Badge> : null}
          {cliente.cedula ? <span>{cliente.cedula}</span> : null}
          {whatsappDigits ? (
            <a
              href={`https://wa.me/${whatsappDigits}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Phone className="h-3 w-3" /> {cliente.whatsapp}
            </a>
          ) : null}
          {cliente.ciudad ? (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {cliente.ciudad}{cliente.estado ? `, ${cliente.estado}` : ''}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Paquetes" value={resumen.paquetes_registrados} />
          <Metric label="En tránsito" value={resumen.paquetes_en_transito} />
          <Metric label="Recibos (CBM)" value={cbm(resumen.recibos_cbm_total)} />
          <Metric label="Saldo pendiente" value={money(resumen.saldo_pendiente_usd)} />
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-border/70 px-3 py-2 text-xs text-muted-foreground">
          <Wallet className="h-3.5 w-3.5 text-primary" />
          Crédito a favor: <strong className="text-foreground">{money(context.credito_disponible_usd)}</strong>
          {resumen.tickets_abiertos > 0 ? <span className="ml-auto text-foreground">{resumen.tickets_abiertos} ticket(s) abierto(s)</span> : null}
        </div>

        <AssistantHistoryList
          title="Paquetes"
          count={resumen.paquetes_registrados}
          items={context.paquetes}
          empty="Sin paquetes registrados todavía."
          renderItem={(item) => (
            <div className="space-y-0.5">
              <p className="font-semibold">{item.tracking}</p>
              <p className="text-muted-foreground">
                {item.estado} · {item.envio || 'marítimo'} · {item.tipo_carga}
                {item.recibido_en_almacen ? ` · recibido ${item.recibido_en_almacen}` : ''}
                {item.reconocido_venezuela ? ` · en Venezuela ${item.reconocido_venezuela}` : ''}
              </p>
            </div>
          )}
        />

        <AssistantHistoryList
          title="Recibos de carga (CBM)"
          count={context.recibos.length}
          items={context.recibos}
          empty="Sin recibos de CBM."
          renderItem={(item) => (
            <div className="space-y-0.5">
              <p className="font-semibold">{item.orden || 'Sin N° de contenedor'} · {cbm(item.cbm)}</p>
              <p className="text-muted-foreground">
                {item.trackings} tracking(s){item.disponible_para_entrega ? ' · disponible para entrega' : ''}
                {item.llegada_estimada ? ` · llegada estimada ${item.llegada_estimada}` : ''}
              </p>
            </div>
          )}
        />

        <AssistantHistoryList
          title="Facturas"
          count={context.facturas.length}
          items={context.facturas}
          empty="Sin facturas emitidas."
          renderItem={(item) => (
            <div className="space-y-0.5">
              <p className="font-semibold">{item.numero} · {money(item.total)}</p>
              <p className="text-muted-foreground">
                {item.estado}{item.saldo > 0 ? ` · saldo ${money(item.saldo)}` : ' · pagada completa'}
                {item.fecha ? ` · ${item.fecha}` : ''}
              </p>
            </div>
          )}
        />

        <AssistantHistoryList
          title="Consolidaciones"
          count={context.consolidaciones.length}
          items={context.consolidaciones}
          empty="Sin consolidaciones."
          renderItem={(item) => (
            <div className="space-y-0.5">
              <p className="font-semibold">{item.tracking} · {cbm(item.cbm)}</p>
              <p className="text-muted-foreground">
                {item.estado}{item.entrega_estimada ? ` · entrega estimada ${item.entrega_estimada}` : ''}
                {item.pago_validado ? ' · pago validado' : ''}
              </p>
            </div>
          )}
        />

        <AssistantHistoryList
          title="Tickets de soporte"
          count={context.tickets.length}
          items={context.tickets}
          empty="Sin tickets previos."
          renderItem={(item) => (
            <div className="space-y-0.5">
              <p className="font-semibold">{item.numero} · {item.asunto}</p>
              <p className="text-muted-foreground">{item.estado} · {item.prioridad}{item.fecha ? ` · ${item.fecha}` : ''}</p>
              {item.ultimo_mensaje ? <p className="text-muted-foreground">Último mensaje: {item.ultimo_mensaje}</p> : null}
            </div>
          )}
        />

        {context.notas_internas.length > 0 ? (
          <AssistantHistoryList
            title="Notas internas"
            count={context.notas_internas.length}
            items={context.notas_internas}
            empty="Sin notas."
            renderItem={(item) => (
              <div className="space-y-0.5">
                <p>{item.nota}</p>
                <p className="text-muted-foreground">{item.fecha}{item.autor ? ` · ${item.autor}` : ''}</p>
              </div>
            )}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}