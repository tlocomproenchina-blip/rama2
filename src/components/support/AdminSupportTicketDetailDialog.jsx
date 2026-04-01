import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import TicketChat from '@/components/support/TicketChat';

export default function AdminSupportTicketDetailDialog({ selectedTicket, setSelectedTicket, statusConfig, handleSendMessage, user }) {
  return (
    <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>{selectedTicket?.subject}</DialogTitle>
              <p className="text-sm text-slate-500 font-mono mt-1">{selectedTicket?.ticket_number}</p>
              <p className="text-sm text-slate-500 mt-1">Cliente: {selectedTicket?.client_email}</p>
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
        />
      </DialogContent>
    </Dialog>
  );
}