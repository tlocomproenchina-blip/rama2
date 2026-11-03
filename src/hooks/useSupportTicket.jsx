import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { uploadSupportImages } from '@/components/support/supportUploadUtils';

const STATUS_NOTICE = {
  abierto: 'Tu ticket ha sido reabierto',
  en_proceso: 'Tu ticket está siendo atendido',
  resuelto: 'Tu ticket ha sido resuelto',
  cerrado: 'Tu ticket ha sido cerrado',
};

const notifyClient = (ticket, title, message) => base44.entities.Notification.create({
  user_email: ticket.client_email, title, message, type: 'general', icon: 'alert', reference_id: ticket.id,
}).catch(() => {});

// Un caso (SupportTicket) en vivo: conversación, respuesta al cliente y cambio de estado.
export default function useSupportTicket(ticketId, user) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticketId) { setTicket(null); return undefined; }
    setLoading(true);
    base44.entities.SupportTicket.get(ticketId).then(setTicket).finally(() => setLoading(false));
    return base44.entities.SupportTicket.subscribe((event) => {
      if (event.id !== ticketId) return;
      if (event.type === 'delete') setTicket(null);
      else setTicket((prev) => ({ ...(prev || {}), ...event.data }));
    });
  }, [ticketId]);

  const sendMessage = useCallback(async (message, files = []) => {
    const attachments = await uploadSupportImages(files, 3);
    const entry = {
      sender_email: user.email, sender_name: user.full_name || user.email, message,
      timestamp: new Date().toISOString(), is_admin: true, attachments,
    };
    const messages = [...(ticket.messages || []), entry];
    const patch = { messages, ...(ticket.status === 'abierto' ? { status: 'en_proceso' } : {}) };
    try {
      await base44.entities.SupportTicket.update(ticket.id, patch);
      setTicket((prev) => ({ ...prev, ...patch }));
      notifyClient(ticket, '💬 Nueva Respuesta', `Tienes una nueva respuesta en ${ticket.ticket_number}`);
      toast.success('Respuesta enviada al cliente');
      return true;
    } catch {
      toast.error('No se pudo enviar la respuesta');
      return false;
    }
  }, [ticket, user]);

  const setStatus = useCallback(async (status) => {
    const patch = { status, ...(status === 'resuelto' || status === 'cerrado' ? { resolved_date: new Date().toISOString() } : {}) };
    try {
      await base44.entities.SupportTicket.update(ticket.id, patch);
      setTicket((prev) => ({ ...prev, ...patch }));
      notifyClient(ticket, '🔔 Actualización de Ticket', `${ticket.ticket_number}: ${STATUS_NOTICE[status]}`);
      toast.success('Estado actualizado');
    } catch {
      toast.error('No se pudo actualizar el estado');
    }
  }, [ticket]);

  return { ticket, loading, sendMessage, setStatus };
}