import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare } from 'lucide-react';

export default function CreateTicketModal({
  pkg,
  message,
  setMessage,
  processing,
  onClose,
  onConfirm,
}) {
  return (
    <Dialog open={!!pkg} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Ticket</DialogTitle>
          <DialogDescription>
            Cliente: {pkg?.client_email} • Tracking: {pkg?.tracking_number}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label>Mensaje (opcional)</Label>
          <Textarea
            rows={4}
            placeholder="Escribe un mensaje para el cliente..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
            Crear Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}