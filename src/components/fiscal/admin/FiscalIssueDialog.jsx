import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FiscalField from '@/components/fiscal/FiscalField';
import FiscalFileField from '@/components/fiscal/FiscalFileField';

const today = () => new Date().toISOString().slice(0, 10);

// Registro de la emisión definitiva: el documento se emite por el mecanismo
// autorizado de la empresa y aquí se guarda su número, fecha y copia.
export default function FiscalIssueDialog({ open, request, busy, onConfirm, onClose }) {
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [doc, setDoc] = useState({ uri: '', type: '' });

  useEffect(() => {
    if (open) { setNumber(request?.request_number || ''); setDate(today()); setNotes(''); setDoc({ uri: '', type: '' }); }
  }, [open, request]);

  const invalid = !number.trim() || !date || !doc.uri;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar factura fiscal emitida</DialogTitle>
          <DialogDescription>
            Registra los datos de la factura emitida con el sistema autorizado de la empresa y adjunta su copia. El número sugerido es solo referencial.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <FiscalField label="Número del documento fiscal *"><Input value={number} onChange={(e) => setNumber(e.target.value)} maxLength={40} /></FiscalField>
          <FiscalField label="Fecha de emisión *"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></FiscalField>
          <FiscalFileField label="Copia del documento definitivo *" value={doc.uri} type={doc.type} onChange={setDoc} />
          <FiscalField label="Observaciones"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></FiscalField>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" disabled={invalid || busy} onClick={() => onConfirm({ document_number: number.trim(), issued_date: date, document_uri: doc.uri, document_type: doc.type, notes: notes.trim() })}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Registrar emisión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}