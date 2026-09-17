import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import TicketChat from '@/components/support/TicketChat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, UserSearch, Bot, Send, X, AlertTriangle } from 'lucide-react';
import ClientSupport360 from '@/components/support/client360/ClientSupport360';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AdminSupportTicketDetailDialog({ selectedTicket, setSelectedTicket, statusConfig, handleSendMessage, handleStatusChange, user, setOpenedTicketIds, setManuallyUnreadTicketIds }) {
  const [fetchedClient, setFetchedClient] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [draftAction, setDraftAction] = useState(null);
  const [draftSending, setDraftSending] = useState(false);

  useEffect(() => {
    setDraftText(selectedTicket?.ai_pending_draft || '');
    setDraftAction(selectedTicket?.ai_pending_draft ? 'answer' : null);
  }, [selectedTicket?.id, selectedTicket?.ai_pending_draft]);

  const handleApproveDraft = async () => {
    if (!draftText.trim() || !selectedTicket) return;
    setDraftSending(true);
    try {
      const success = await handleSendMessage(draftText.trim(), []);
      if (success) {
        await base44.entities.SupportTicket.update(selectedTicket.id, {
          ai_pending_draft: null,
          ai_draft_date: null
        });
        setDraftAction(null);
        setDraftText('');
        toast.success('Borrador IA aprobado y enviado');
      }
    } catch {
      toast.error('No se pudo aprobar el borrador');
    }
    setDraftSending(false);
  };

  const handleDiscardDraft = async () => {
    if (!selectedTicket) return;
    setDraftSending(true);
    try {
      await base44.entities.SupportTicket.update(selectedTicket.id, {
        ai_pending_draft: null,
        ai_draft_date: null
      });
      setDraftAction(null);
      setDraftText('');
      toast.success('Borrador IA descartado');
    } catch {
      toast.error('No se pudo descartar el borrador');
    }
    setDraftSending(false);
  };

  // Si el cliente no vino en la lista precargada, buscarlo directamente por email
  useEffect(() => {
    setFetchedClient(null);
    const email = selectedTicket?.client_email;
    if (!email || selectedTicket?.client) return;
    let active = true;
    base44.functions.invoke('listClientsForSupport', { q: email, limit: 5, skip: 0, includeCounts: false })
      .then((res) => {
        if (!active) return;
        const list = res?.data?.data || [];
        const match = list.find((c) => (c.email || '').toLowerCase() === email.toLowerCase());
        if (match) setFetchedClient(match);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [selectedTicket?.client_email, selectedTicket?.client]);

  const client = selectedTicket?.client || fetchedClient;
  const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ') || client?.full_name || 'Sin nombre';
  const clientPhone = client?.whatsapp || client?.phone || client?.phone_number || 'Sin número';
  const clientShippingMark = client?.shipping_mark || 'Sin shipping mark';

  useEffect(() => {
    if (!selectedTicket?.id) return;
    const messages = selectedTicket.messages || [];
    const lastClientMessage = [...messages].reverse().find((msg) => !msg.is_admin);
    if (!lastClientMessage) return;

    // Comparar por orden en la conversación (no por horas, que dependen del reloj del dispositivo)
    const lastClientIdx = messages.map((m) => !m.is_admin).lastIndexOf(true);
    const lastAdminIdx = messages.map((m) => !!m.is_admin).lastIndexOf(true);
    if (lastAdminIdx > lastClientIdx) return;

    const lastMessageKey = `${selectedTicket.id}:${lastClientMessage.timestamp}`;
    setOpenedTicketIds?.((prev) => prev.includes(lastMessageKey) ? prev : [...prev, lastMessageKey]);
    setManuallyUnreadTicketIds?.((prev) => prev.filter((item) => item !== selectedTicket.id));
  }, [selectedTicket?.id, selectedTicket?.messages, setOpenedTicketIds, setManuallyUnreadTicketIds]);

  return (
    <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle>{selectedTicket?.subject}</DialogTitle>
              <p className="text-sm text-slate-500 font-mono mt-1">{selectedTicket?.ticket_number}</p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                <p className="text-sm"><span className="font-semibold text-slate-700">Nombre:</span> <span className="text-slate-600">{clientName}</span></p>
                <p className="text-sm"><span className="font-semibold text-slate-700">Email:</span> <span className="text-slate-600">{selectedTicket?.client_email}</span></p>
                <p className="text-sm"><span className="font-semibold text-slate-700">Número:</span> <span className="text-slate-600">{clientPhone}</span></p>
                <p className="text-sm"><span className="font-semibold text-slate-700">Shipping Mark:</span> <span className="text-slate-600">{clientShippingMark}</span></p>
              </div>
              {selectedTicket?.related_tracking && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-slate-500">Tracking relacionado:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTicket.related_tracking.split(',').map((tn, i) => (
                      <Badge key={i} variant="outline" className="font-mono text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {tn.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Badge className={statusConfig[selectedTicket?.status]?.color}>
              {statusConfig[selectedTicket?.status]?.label}
            </Badge>
          </div>
        </DialogHeader>
        <Tabs defaultValue="chat">
          <TabsList>
            <TabsTrigger value="chat">
              <MessageSquare className="h-4 w-4 mr-2" />
              Conversación
            </TabsTrigger>
            <TabsTrigger value="cliente">
              <UserSearch className="h-4 w-4 mr-2" />
              Datos del cliente
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chat">
            {selectedTicket?.ai_pending_draft && (
              <div className="mb-4 p-4 rounded-xl border-2 border-violet-300 bg-violet-50 space-y-3">
                <div className="flex items-center gap-2 text-violet-700">
                  <Bot className="h-4 w-4" />
                  <p className="font-semibold text-sm">Borrador de respuesta IA — pendiente de revisión</p>
                </div>
                <Textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={5}
                  placeholder="Revisa y edita el borrador de la IA..."
                  disabled={draftSending}
                />
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleApproveDraft} disabled={draftSending || !draftText.trim()} size="sm" className="bg-violet-600 hover:bg-violet-700">
                    <Send className="h-4 w-4 mr-1" />
                    Aprobar y enviar
                  </Button>
                  <Button onClick={handleDiscardDraft} disabled={draftSending} size="sm" variant="outline">
                    <X className="h-4 w-4 mr-1" />
                    Descartar
                  </Button>
                </div>
              </div>
            )}
            {selectedTicket?.ai_escalated && (
              <div className="mb-4 p-3 rounded-xl border border-red-300 bg-red-50 flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="text-sm font-medium">La IA escaló este ticket a un agente humano. Requiere atención manual.</p>
              </div>
            )}
            <TicketChat
              messages={selectedTicket?.messages || []}
              onSendMessage={handleSendMessage}
              currentUserEmail={user.email}
              disabled={selectedTicket?.status === 'cerrado'}
              maxFiles={Math.max(1, (selectedTicket?.related_tracking || '').split(',').map(item => item.trim()).filter(Boolean).length || 3)}
              status={selectedTicket?.status}
              onStatusChange={(value) => handleStatusChange?.(selectedTicket, value)}
              statusOptions={[
                { value: 'abierto', label: 'Abierto' },
                { value: 'en_proceso', label: 'En Proceso' },
                { value: 'resuelto', label: 'Resuelto' },
                { value: 'cerrado', label: 'Cerrado' }
              ]}
            />
          </TabsContent>
          <TabsContent value="cliente">
            <ClientSupport360 clientEmail={selectedTicket?.client_email} currentTicketId={selectedTicket?.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}