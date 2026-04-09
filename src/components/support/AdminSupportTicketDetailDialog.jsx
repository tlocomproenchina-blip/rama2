import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import TicketChat from '@/components/support/TicketChat';

export default function AdminSupportTicketDetailDialog({ selectedTicket, setSelectedTicket, statusConfig, handleSendMessage, user, setOpenedTicketIds, setManuallyUnreadTicketIds }) {
  const client = selectedTicket?.client;
  const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ') || client?.full_name || 'Sin nombre';
  const clientPhone = client?.whatsapp || client?.phone || client?.phone_number || 'Sin número';
  const clientShippingMark = client?.shipping_mark || 'Sin shipping mark';

  useEffect(() => {
    if (!selectedTicket?.id) return;
    const lastClientMessage = [...(selectedTicket.messages || [])].reverse().find((msg) => !msg.is_admin);
    if (!lastClientMessage) return;
    const lastMessageKey = `${selectedTicket.id}:${lastClientMessage.timestamp}`;
    setOpenedTicketIds?.((prev) => prev.includes(lastMessageKey) ? prev : [...prev, lastMessageKey]);
    setManuallyUnreadTicketIds?.((prev) => prev.filter((item) => item !== selectedTicket.id));
  }, [selectedTicket?.id, selectedTicket?.messages, setOpenedTicketIds, setManuallyUnreadTicketIds]);

  return (
    <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
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
        <TicketChat
          messages={selectedTicket?.messages || []}
          onSendMessage={handleSendMessage}
          currentUserEmail={user.email}
          disabled={selectedTicket?.status === 'cerrado'}
          maxFiles={Math.max(1, (selectedTicket?.related_tracking || '').split(',').map(item => item.trim()).filter(Boolean).length || 3)}
        />
      </DialogContent>
    </Dialog>
  );
}