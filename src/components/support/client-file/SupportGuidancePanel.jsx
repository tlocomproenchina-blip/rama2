import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Compass } from 'lucide-react';
import { toast } from 'sonner';

const fdate = (value) => (value
  ? new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');

// Indicaciones del supervisor para el ATC: qué hacer con este cliente o con un
// caso concreto. Quedan en el expediente y solo las ve el equipo interno.
export default function SupportGuidancePanel({ clientEmail, clientName, clientCedula, cases = [], user }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [caseId, setCaseId] = useState('general');
  const [addressedTo, setAddressedTo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!clientEmail) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await base44.entities.SupportClientNote.filter(
        { client_email: clientEmail, note_type: 'indicacion' },
        '-created_date',
        200,
      );
      setNotes(rows || []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [clientEmail]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const note = text.trim();
    if (!note) {
      toast.error('Escribe la indicación antes de guardarla');
      return;
    }
    const linked = cases.find((item) => item.id === caseId) || null;
    setSaving(true);
    try {
      await base44.entities.SupportClientNote.create({
        client_email: clientEmail,
        client_name: clientName || '',
        client_cedula: clientCedula || '',
        ticket_id: linked?.id || null,
        ticket_number: linked?.ticket_number || '',
        note_type: 'indicacion',
        addressed_to: addressedTo.trim(),
        addressed_to_name: addressedTo.trim(),
        note,
        author_email: user?.email || '',
        author_name: user?.full_name || user?.email || 'Supervisión',
      });
      setText('');
      setAddressedTo('');
      setCaseId('general');
      toast.success('Indicación guardada para el ATC');
      await load();
    } catch {
      toast.error('No se pudo guardar la indicación');
    }
    setSaving(false);
  };

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Compass className="h-4 w-4 text-primary" /> Indicaciones al ATC
          {notes.length > 0 ? <Badge variant="secondary" className="ml-1">{notes.length}</Badge> : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Guía interna para orientar la atención de este cliente o de un caso. No se le muestra al cliente.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="Qué debe hacer el ATC con este cliente, qué revisar y qué no ofrecer…"
            disabled={saving}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={caseId} onValueChange={setCaseId}>
              <SelectTrigger><SelectValue placeholder="Vincular a un caso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Cliente en general</SelectItem>
                {cases.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.ticket_number} · {item.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={addressedTo}
              onChange={(event) => setAddressedTo(event.target.value)}
              placeholder="Dirigida a (opcional): ATC, supervisor…"
              disabled={saving}
            />
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving || !text.trim()} className="w-full sm:w-auto">
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Guardar indicación
          </Button>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando indicaciones…
          </p>
        ) : notes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Todavía no hay indicaciones para este cliente.
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-2xl border border-primary/25 bg-primary/5 p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className="border-primary/30 bg-background text-[10px] text-primary">
                    {note.ticket_id ? `Caso ${note.ticket_number || 'soporte'}` : 'Cliente'}
                  </Badge>
                  {note.addressed_to ? <span>Para: <strong className="text-foreground">{note.addressed_to}</strong></span> : null}
                  <span className="font-medium text-foreground">{note.author_name || note.author_email || 'Supervisión'}</span>
                  <span>·</span>
                  <span>{fdate(note.created_date)}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{note.note}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}