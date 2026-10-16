import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, History, Loader2, MessageSquare } from 'lucide-react';
import TicketChat from '@/components/support/TicketChat';
import SupportCaseSummary from '@/components/support/SupportCaseSummary';
import SupportClientProfileCard from '@/components/support/client-file/SupportClientProfileCard';
import ClientSupport360 from '@/components/support/client360/ClientSupport360';

// Todo lo que el ATC necesita a la vista para trabajar el caso: el resumen que
// dejó al escalarlo, la conversación con el cliente, sus datos y su historial.
export default function AssistantCaseContext({ ticket, client, loadingClient }) {
  return (
    <div className="space-y-5">
      {ticket.escalation_summary ? (
        <Card className="border-border/70 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" /> Resumen del caso
            </CardTitle>
            <p className="text-xs text-muted-foreground">Lo que se dejó al escalarlo: qué está pasando y qué había que verificar.</p>
          </CardHeader>
          <CardContent>
            <SupportCaseSummary text={ticket.escalation_summary} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-border/70 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" /> Conversación con el cliente
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Historial del caso. Tu respuesta al cliente se envía desde arriba, en "Responder al cliente".
            </p>
          </CardHeader>
          <CardContent>
            <TicketChat messages={ticket.messages || []} disabled scrollClassName="max-h-[28rem]" />
          </CardContent>
        </Card>

        <div className="space-y-5">
          {loadingClient ? (
            <Card className="border-border/70 shadow-card">
              <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando los datos del cliente…
              </CardContent>
            </Card>
          ) : (
            <SupportClientProfileCard client={client} />
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Historial completo del cliente</h3>
        </div>
        <ClientSupport360 clientEmail={ticket.client_email} currentTicketId={ticket.id} />
      </div>
    </div>
  );
}