import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

export default function InternalMessageComposer({ onSend, disabled }) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(message);
    setMessage('');
  };

  return (
    <div className="space-y-3">
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escribe un mensaje para el equipo..." rows={3} disabled={disabled} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
      <div className="flex justify-end">
        <Button onClick={handleSend} disabled={disabled || !message.trim()} className="bg-blue-600 hover:bg-blue-700"><Send className="h-4 w-4 mr-2" />Enviar</Button>
      </div>
    </div>
  );
}