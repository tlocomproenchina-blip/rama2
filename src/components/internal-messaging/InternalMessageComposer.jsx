import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import SupportImageUploader from '@/components/support/SupportImageUploader';

export default function InternalMessageComposer({ onSend, disabled }) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);

  const handleSend = () => {
    if (!message.trim() && attachments.length === 0) return;
    onSend(message, attachments);
    setMessage('');
    setAttachments([]);
  };

  return (
    <div className="space-y-3">
      <SupportImageUploader files={attachments} onChange={setAttachments} disabled={disabled} />
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escribe un mensaje para el equipo..." rows={3} disabled={disabled} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
      <div className="flex justify-end">
        <Button onClick={handleSend} disabled={disabled || (!message.trim() && attachments.length === 0)} className="bg-blue-600 hover:bg-blue-700"><Send className="h-4 w-4 mr-2" />Enviar</Button>
      </div>
    </div>
  );
}