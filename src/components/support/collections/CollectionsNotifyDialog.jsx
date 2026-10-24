import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { buildWhatsAppUrl } from '@/lib/whatsappContact';
import { collectionMessage } from '@/lib/collections';

// Notificación de pago: el texto sale de los días vencidos de la factura y se
// puede ajustar antes de enviarlo por email o abrir WhatsApp.
export default function CollectionsNotifyDialog({ invoice, aging, open, onOpenChange }) {
  const template = useMemo(() => collectionMessage(invoice, aging), [invoice, aging]);
  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState(template.subject);
  const [emailText, setEmailText] = useState(template.body);
  const [whatsappText, setWhatsappText] = useState(template.whatsapp);
  const [sending, setSending] = useState(false);

  const phone = String(invoice?.client_whatsapp || '').trim();
  const email = String(invoice?.client_email || '').trim();

  useEffect(() => {
    if (!open) return;
    setSubject(template.subject);
    setEmailText(template.body);
    setWhatsappText(template.whatsapp);
    setChannel('email');
  }, [open, template]);

  const send = async () => {
    if (channel === 'email') {
      if (!email) {
        toast.error('La factura no tiene email de cliente');
        return;
      }
      setSending(true);
      try {
        const res = await base44.functions.invoke('sendNotificationEmail', {
          to: email,
          subject,
          body: emailText,
        });
        const data = res?.data || {};
        if (data.email_sent === false) {
          toast.error('No se pudo enviar el email; quedó registrado para reintento');
        } else {
          toast.success(`Recordatorio enviado a ${email}`);
        }
        onOpenChange(false);
      } catch (error) {
        toast.error('No se pudo enviar el email');
      }
      setSending(false);
      return;
    }

    const url = buildWhatsAppUrl(phone, whatsappText);
    if (!url) {
      toast.error('No hay un WhatsApp válido para este cliente');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            Notificar pago · {invoice?.invoice_number || 'Factura'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setChannel('email')}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                channel === 'email'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
            <button
              type="button"
              onClick={() => setChannel('whatsapp')}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                channel === 'whatsapp'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>
          </div>

          {channel === 'email' ? (
            <>
              <div className="space-y-2">
                <Label>Para</Label>
                <Input value={email || 'Sin email registrado'} readOnly className="bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label>Asunto</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mensaje</Label>
                <Textarea value={emailText} onChange={(e) => setEmailText(e.target.value)} rows={11} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input value={phone || 'Sin WhatsApp registrado'} readOnly className="bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label>Mensaje</Label>
                <Textarea value={whatsappText} onChange={(e) => setWhatsappText(e.target.value)} rows={8} />
              </div>
              <p className="text-xs text-slate-500">
                Se abre WhatsApp con el mensaje listo para que lo revises y lo envíes.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={send} disabled={sending} className="bg-emerald-600 hover:bg-emerald-700">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : channel === 'email' ? <Mail className="mr-2 h-4 w-4" /> : <MessageCircle className="mr-2 h-4 w-4" />}
            {channel === 'email' ? 'Enviar email' : 'Abrir WhatsApp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}