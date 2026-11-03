import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import AssistantCaseSupervisorReplies from '@/components/support/assistant/AssistantCaseSupervisorReplies';

// Respuesta interna de Supervisión dentro de la ficha del caso (solo casos escalados).
export default function CrmCaseSupervision({ ticketId, client, user, onLoadToAssistant }) {
  const [ticket, setTicket] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTicket(null);
    base44.entities.SupportTicket.get(ticketId).then(setTicket);
  }, [ticketId]);

  if (!ticket?.escalated) return null;
  const pending = ticket.atc_review_status !== 'revisado';

  const markAttended = async () => {
    setSaving(true);
    const updates = {
      atc_review_status: 'revisado',
      atc_review_date: new Date().toISOString(),
      atc_review_by_name: user?.full_name || user?.email || '',
    };
    await base44.entities.SupportTicket.update(ticket.id, updates);
    setTicket({ ...ticket, ...updates });
    setSaving(false);
    toast.success('Respuesta de supervisión marcada como atendida');
  };

  return (
    <div className="space-y-2">
      <AssistantCaseSupervisorReplies ticket={ticket} client={client} onLoadToAssistant={onLoadToAssistant} />
      {pending ? (
        <Button size="sm" variant="outline" onClick={markAttended} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Marcar atendido
        </Button>
      ) : (
        <p className="text-xs text-emerald-700">Respuesta de supervisión ya atendida{ticket.atc_review_by_name ? ` por ${ticket.atc_review_by_name}` : ''}.</p>
      )}
    </div>
  );
}