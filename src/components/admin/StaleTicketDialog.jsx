import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Ticket } from 'lucide-react';
import { toast } from 'sonner';

export default function StaleTicketDialog({ open, onOpenChange, clientEmail, trackingNumbers, onCreated }) {
  const [extraMessage, setExtraMessage] = useState('');
  const [sending, setSending] = useState(false);

  const subject = 'Requerimos su atención con los siguientes paquetes';

  const trackingList = (trackingNumbers || []).join('\n');

  const handleCreate = async () => {
    if (!clientEmail) return;
    setSending(true);
    try {
      const fullBody = trackingList + (extraMessage.trim() ? '\n\n' + extraMessage.trim() : '');

      const now = new Date();
      const ticketNumber = `TK-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      await base44.entities.SupportTicket.create({
        ticket_number: ticketNumber,
        client_email: clientEmail,
        subject,
        status: 'abierto',
        priority: 'media',
        category: 'tracking',
        related_tracking: (trackingNumbers || []).join(','),
        messages: [{
          sender_email: 'admin',
          sender_name: 'Administrador',
          message: fullBody,
          timestamp: now.toISOString(),
          is_admin: true,
          attachments: []
        }]
      });

      toast.success(`Ticket creado para ${clientEmail}`);
      onCreated?.();
      setExtraMessage('');
      onOpenChange(false);
    } catch (err) {
      toast.error('Error al crear ticket: ' + (err?.message || 'desconocido'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-amber-600" />
            Crear Ticket de Soporte
          </DialogTitle>
          <DialogDescription>
            Se creará un ticket para <strong>{clientEmail}</strong> con {trackingNumbers?.length || 0} tracking(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium text-slate-700">Asunto</label>
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mt-1">{subject}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Trackings incluidos</label>
            <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap font-mono">
              {trackingList}
            </pre>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Mensaje adicional (opcional)</label>
            <Textarea
              value={extraMessage}
              onChange={(e) => setExtraMessage(e.target.value)}
              placeholder="Escriba información adicional aquí..."
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={sending} className="bg-amber-600 hover:bg-amber-700 gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            Crear Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}