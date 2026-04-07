import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export default function QuickMessagePicker({ onPick }) {
  const [messages, setMessages] = useState([]);
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    base44.entities.SupportQuickMessage.filter({ is_active: true }, 'order').then(setMessages).catch(() => setMessages([]));
  }, []);

  const filteredMessages = useMemo(() => (
    category === 'all' ? messages : messages.filter((item) => item.category === category)
  ), [messages, category]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select value={category} onValueChange={(value) => { setCategory(value); setSelectedId(''); }}>
        <SelectTrigger className="sm:w-40">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="saludo">Saludo</SelectItem>
          <SelectItem value="seguimiento">Seguimiento</SelectItem>
          <SelectItem value="pago">Pago</SelectItem>
          <SelectItem value="tracking">Tracking</SelectItem>
          <SelectItem value="cierre">Cierre</SelectItem>
          <SelectItem value="otro">Otro</SelectItem>
        </SelectContent>
      </Select>

      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Mensaje predeterminado" />
        </SelectTrigger>
        <SelectContent>
          {filteredMessages.map((item) => (
            <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        disabled={!selectedId}
        onClick={() => {
          const selected = filteredMessages.find((item) => item.id === selectedId);
          if (selected) onPick(selected);
        }}
      >
        Usar
      </Button>
    </div>
  );
}