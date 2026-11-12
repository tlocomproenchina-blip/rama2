import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Confirmación de una decisión administrativa con observaciones (obligatorias o no).
export default function FiscalDecisionDialog({ open, title, description, required, confirmLabel, destructive, busy, onConfirm, onClose }) {
  const [notes, setNotes] = useState('');
  useEffect(() => { if (open) setNotes(''); }, [open]);
  const missing = required && notes.trim().length < 3;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder={required ? 'Observaciones (obligatorio)' : 'Observaciones (opcional)'} />
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} disabled={missing || busy} onClick={() => onConfirm(notes.trim())}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}