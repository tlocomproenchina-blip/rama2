import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Send, User, Shield, Bot, ThumbsUp, ThumbsDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import SupportImageUploader from '@/components/support/SupportImageUploader';
import SupportAttachmentsPreview from '@/components/support/SupportAttachmentsPreview';
import QuickMessagePicker from '@/components/support/QuickMessagePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

export default function TicketChat({ messages, onSendMessage, currentUserEmail, disabled, maxFiles = 3, status, onStatusChange, statusOptions = [], ticketId, feedbackReceived, onFeedbackSubmitted, attachmentAccept = 'image/*', attachmentsLabel }) {
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [localFeedback, setLocalFeedback] = useState(null);

  const handleFeedback = async (feedback) => {
    if (feedbackSending || localFeedback) return;
    setFeedbackSending(true);
    setLocalFeedback(feedback);
    try {
      const res = await base44.functions.invoke('submitTicketFeedback', { ticket_id: ticketId, feedback });
      if (res?.data?.error) {
        toast.error(res.data.error);
        setLocalFeedback(null);
      } else {
        toast.success(feedback === 'positivo' ? '¡Gracias por tu feedback!' : 'Te ayudaremos con más información.');
        if (onFeedbackSubmitted) onFeedbackSubmitted(res?.data);
      }
    } catch {
      toast.error('No se pudo enviar el feedback');
      setLocalFeedback(null);
    }
    setFeedbackSending(false);
  };

  // Find last AI message index
  const lastAiMsgIdx = messages?.length ? (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].is_ai) return i;
    }
    return -1;
  })() : -1;

  const showFeedbackButtons = ticketId && lastAiMsgIdx >= 0 && lastAiMsgIdx === messages.length - 1 && !feedbackReceived && !localFeedback;

  const handleSend = async () => {
    if ((!newMessage.trim() && attachments.length === 0) || sending) return;
    const messageToSend = newMessage;
    const attachmentsToSend = attachments;
    setNewMessage('');
    setAttachments([]);
    setSending(true);
    const success = await onSendMessage(messageToSend, attachmentsToSend);
    if (!success) {
      setNewMessage(messageToSend);
      setAttachments(attachmentsToSend);
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      {/* Messages */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {messages?.length === 0 ? (
          <p className="text-center text-slate-400 py-8">No hay mensajes aún</p>
        ) : (
          messages?.map((msg, idx) => {
            const isEmployeeMessage = msg.is_admin;
            const isAiMessage = msg.is_ai;
            return (
              <div key={idx} className={`flex gap-3 ${isEmployeeMessage || isAiMessage ? '' : 'flex-row-reverse'}`}>
                <Avatar className={`h-8 w-8 flex items-center justify-center ${isAiMessage ? 'bg-violet-100' : isEmployeeMessage ? 'bg-slate-100' : 'bg-green-100'}`}>
                  {isAiMessage ? (
                    <Bot className="h-4 w-4 text-violet-600" />
                  ) : isEmployeeMessage ? (
                    <Shield className="h-4 w-4 text-slate-600" />
                  ) : (
                    <User className="h-4 w-4 text-green-700" />
                  )}
                </Avatar>
                <div className={`flex-1 ${isEmployeeMessage || isAiMessage ? 'text-left' : 'text-right'}`}>
                    <div className={`inline-block max-w-[80%] ${isAiMessage ? 'bg-violet-50 text-slate-800 border border-violet-200' : isEmployeeMessage ? 'bg-slate-100 text-slate-800' : 'bg-green-500 text-white'} rounded-2xl px-4 py-2`}>
                      <div className={`mb-1 flex items-center gap-2 text-[11px] ${isAiMessage ? 'justify-between text-violet-600' : isEmployeeMessage ? 'justify-between text-slate-500' : 'justify-end text-green-50'}`}>
                        <p className="text-sm font-medium flex items-center gap-1">
                          {msg.sender_name}
                          {isAiMessage && <span className="text-[9px] bg-violet-200 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold">IA</span>}
                        </p>
                        <span>{format(new Date(msg.timestamp), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                      {msg.message ? <p className="text-sm whitespace-pre-wrap">{msg.message}</p> : null}
                      <SupportAttachmentsPreview attachments={msg.attachments} />
                    </div>
                    {showFeedbackButtons && idx === lastAiMsgIdx && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-slate-500">¿Te ayudó esta respuesta?</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFeedback('positivo')}
                          disabled={feedbackSending}
                          className="h-8 gap-1.5 rounded-full border-green-200 text-green-700 hover:bg-green-50"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" /> Sí
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFeedback('negativo')}
                          disabled={feedbackSending}
                          className="h-8 gap-1.5 rounded-full border-orange-200 text-orange-700 hover:bg-orange-50"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" /> No
                        </Button>
                      </div>
                    )}
                    {localFeedback && idx === lastAiMsgIdx && (
                      <div className="mt-2 text-xs text-slate-500 italic">
                        {localFeedback === 'positivo' ? '✓ Indicaste que quedaste satisfecho' : '✓ Indicaste que necesitas más ayuda'}
                      </div>
                    )}
                  </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      {!disabled && (
        <div className="space-y-3">
          {!!statusOptions.length && onStatusChange && (
            <div className="flex justify-end">
              <Select value={status} onValueChange={onStatusChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <QuickMessagePicker onPick={(selected) => {
            setNewMessage(selected.message || '');
            setAttachments((selected.image_urls || []).map((url, index) => ({ url, name: `imagen-${index + 1}` })));
          }} />
          <SupportImageUploader
            files={attachments}
            onChange={setAttachments}
            maxFiles={maxFiles}
            accept={attachmentAccept}
            label={attachmentsLabel}
          />
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe tu mensaje..."
              rows={3}
              disabled={sending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button onClick={handleSend} disabled={sending} className="bg-blue-600 hover:bg-blue-700">
              {sending ? <Send className="h-4 w-4 opacity-50" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}