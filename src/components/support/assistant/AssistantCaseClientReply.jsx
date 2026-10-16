import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, SendHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import SupportImageUploader from '@/components/support/SupportImageUploader';
import { uploadSupportCaseFiles } from '@/lib/supportCaseFiles';

// Respuesta del ATC al cliente: es la que sí llega a su ticket de soporte. Al
// enviarla, el caso queda marcado como atendido y sale de la lista pendiente.
export default function AssistantCaseClientReply({ ticket, user, onChange }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);

  const send = async () => {
    const message = text.trim();
    if ((!message && files.length === 0) || sending) return;
    setSending(true);
    try {
      const uploaded = await uploadSupportCaseFiles(files, 5);
      const nowIso = new Date().toISOString();
      const newMessage = {
        sender_email: user?.email,
        sender_name: `${user?.full_name || user?.email || 'ATC'} (ATC)`,
        message,
        timestamp: nowIso,
        is_admin: true,
        attachments: uploaded,
      };
      const updates = {
        messages: [...(ticket.messages || []), newMessage],
        atc_review_status: 'revisado',
        atc_review_date: nowIso,
        atc_review_by_name: user?.full_name || user?.email || '',
      };
      await base44.entities.SupportTicket.update(ticket.id, updates);
      base44.entities.Notification.create({
        user_email: ticket.client_email,
        title: '💬 Nueva Respuesta',
        message: `Tienes una nueva respuesta en ${ticket.ticket_number}`,
        type: 'general',
        icon: 'alert',
        reference_id: ticket.id,
      }).catch(() => {});
      setText('');
      setFiles([]);
      toast.success('Respuesta enviada al cliente · caso marcado como atendido');
      onChange({ ...ticket, ...updates });
    } catch (error) {
      toast.error(error?.message || 'No se pudo enviar la respuesta');
    }
    setSending(false);
  };

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <SendHorizontal className="h-4 w-4 text-primary" /> Responder al cliente
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Esta respuesta sí llega al cliente en su ticket de soporte. Al enviarla, el caso queda marcado como atendido.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          placeholder="Escribe aquí la respuesta que le llegará al cliente…"
          disabled={sending}
        />
        <SupportImageUploader
          files={files}
          onChange={setFiles}
          disabled={sending}
          maxFiles={5}
          accept="image/*,application/pdf"
          label="Adjuntar hasta 5 fotos o PDF"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">Los PDF quedan guardados de forma privada y se abren con un enlace temporal.</p>
          <Button onClick={send} disabled={sending || (!text.trim() && files.length === 0)}>
            {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <SendHorizontal className="mr-1.5 h-4 w-4" />}
            {sending ? 'Enviando…' : 'Enviar al cliente'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}