import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Send, User, Shield } from 'lucide-react';
import { format } from 'date-fns';
import SupportImageUploader from '@/components/support/SupportImageUploader';
import SupportAttachmentsPreview from '@/components/support/SupportAttachmentsPreview';
import QuickMessagePicker from '@/components/support/QuickMessagePicker';

export default function TicketChat({ messages, onSendMessage, currentUserEmail, disabled, maxFiles = 3 }) {
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);

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
            return (
              <div key={idx} className={`flex gap-3 ${isEmployeeMessage ? '' : 'flex-row-reverse'}`}>
                <Avatar className={`h-8 w-8 flex items-center justify-center ${isEmployeeMessage ? 'bg-slate-100' : 'bg-green-100'}`}>
                  {isEmployeeMessage ? (
                    <Shield className="h-4 w-4 text-slate-600" />
                  ) : (
                    <User className="h-4 w-4 text-green-700" />
                  )}
                </Avatar>
                <div className={`flex-1 ${isEmployeeMessage ? 'text-left' : 'text-right'}`}>
                    <div className={`inline-block max-w-[80%] ${isEmployeeMessage ? 'bg-slate-100 text-slate-800' : 'bg-green-500 text-white'} rounded-2xl px-4 py-2`}>
                      <div className={`mb-1 flex items-center gap-2 text-[11px] ${isEmployeeMessage ? 'justify-between text-slate-500' : 'justify-end text-green-50'}`}>
                        <p className="text-sm font-medium">{msg.sender_name}</p>
                        <span>{format(new Date(msg.timestamp), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                      {msg.message ? <p className="text-sm whitespace-pre-wrap">{msg.message}</p> : null}
                      <SupportAttachmentsPreview attachments={msg.attachments} />
                    </div>
                  </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      {!disabled && (
        <div className="space-y-3">
          <QuickMessagePicker onPick={(selected) => {
            setNewMessage(selected.message || '');
            setAttachments((selected.image_urls || []).map((url, index) => ({ url, name: `imagen-${index + 1}` })));
          }} />
          <SupportImageUploader files={attachments} onChange={setAttachments} maxFiles={maxFiles} />
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