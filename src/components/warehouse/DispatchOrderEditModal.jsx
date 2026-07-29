import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, X } from 'lucide-react';

export default function DispatchOrderEditModal({ order, processing, onClose, onSave }) {
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    setItems(Array.isArray(order?.items) ? order.items.map((i) => ({ ...i })) : []);
    setNotes(order?.notes || '');
    setClientName(order?.client_name || '');
  }, [order]);

  if (!order) return null;

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  return (
    <Dialog open={!!order} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modificar orden {order.order_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Paquetes ({items.length})</Label>
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={item.tracking_number || ''}
                  onChange={(e) => updateItem(idx, { tracking_number: e.target.value })}
                  className="font-mono text-sm"
                  placeholder="Tracking"
                />
                <Button variant="ghost" size="icon" className="shrink-0 text-rose-500" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={processing}
            onClick={() => onSave({ items: items.filter((i) => (i.tracking_number || '').trim()), notes, client_name: clientName })}
          >
            {processing && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}