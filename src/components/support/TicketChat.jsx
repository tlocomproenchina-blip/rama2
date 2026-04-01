import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Send, User, Shield } from 'lucide-react';
import { format } from 'date-fns';
import SupportImageUploader from '@/components/support/SupportImageUploader';
import SupportAttachmentsPreview from '@/components/support/SupportAttachmentsPreview';

export default function TicketChat({ messages, onSendMessage, currentUserEmail, disabled }) {
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState([]);

  const handleSend = () => {
    if (!newMessage.trim() && attachments.length === 0) return;
    onSendMessage(newMessage, attachments);
    setNewMessage('');
    setAttachments([]);
  };

  return (
    <div className="space-y-4">
      {/* Messages */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {messages?.length === 0 ? (
          <p className="text-center text-slate-400 py-8">No hay mensajes aún</p>
        ) : (
          messages?.map((msg, idx) => {
            const isCurrentUser = msg.sender_email === currentUserEmail;
            return (
              <div key={idx} className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                <Avatar className={`h-8 w-8 flex items-center justify-center ${msg.is_admin ? 'bg-blue-100' : 'bg-slate-100'}`}>
                  {msg.is_admin ? (
                    <Shield className="h-4 w-4 text-blue-600" />
                  ) : (
                    <User className="h-4 w-4 text-slate-600" />
                  )}
                </Avatar>
                <div className={`flex-1 ${isCurrentUser ? 'text-right' : ''}`}>
                  <div className={`inline-block max-w-[80%] break-words overflow-hidden ${isCurrentUser ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'} rounded-2xl px-4 py-2`}>
                    <p className="text-sm font-medium mb-1">{msg.sender_name}</p>
                    {msg.message ? <p className="text-sm whitespace-pre-wrap">{msg.message}</p> : null}
                    <SupportAttachmentsPreview attachments={msg.attachments} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {format(new Date(msg.timestamp), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      {!disabled && (
        <div className="space-y-3">
          <SupportImageUploader files={attachments} onChange={setAttachments} />
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe tu mensaje..."
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button onClick={handleSend} className="bg-blue-600 hover:bg-blue-700">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}