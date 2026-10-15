import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Lock, Plus } from 'lucide-react';
import { toast } from 'sonner';

const fdate = (value) => (value
  ? new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');

// Notas internas de atención: sin ticketId se listan todas las del cliente
// (las generales y las de cada caso, cada una identificada); con ticketId se
// muestran solo las de ese caso. Nunca se envían ni se muestran al cliente.
export default function SupportNotesPanel({
  clientEmail,
  clientName,
  clientCedula,
  ticketId = null,
  ticketNumber = '',
  user,
  title = 'Notas internas',
}) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!clientEmail) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // En el expediente del cliente las indicaciones del supervisor se muestran
      // en su propia tarjeta: aquí solo quedan las notas del equipo.
      const query = ticketId
        ? { client_email: clientEmail, ticket_id: ticketId }
        : { client_email: clientEmail, note_type: { $ne: 'indicacion' } };
      const rows = await base44.entities.SupportClientNote.filter(query, '-created_date', 200);
      setNotes(rows || []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [clientEmail, ticketId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    const note = text.trim();
    if (!note) {
      toast.error('Escribe la nota antes de guardarla');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.SupportClientNote.create({
        client_email: clientEmail,
        client_name: clientName || '',
        client_cedula: clientCedula || '',
        ticket_id: ticketId || null,
        ticket_number: ticketNumber || '',
        note,
        author_email: user?.email || '',
        author_name: user?.full_name || user?.email || 'Equipo',
      });
      setText('');
      toast.success(ticketId ? 'Nota interna del caso guardada' : 'Nota interna del cliente guardada');
      await load();
    } catch {
      toast.error('No se pudo guardar la nota');
    }
    setSaving(false);
  };

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4 text-amber-600" /> {title}
          {notes.length > 0 ? <Badge variant="secondary" className="ml-1">{notes.length}</Badge> : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Solo para el equipo. Estas notas no llegan al cliente ni se envían por ningún canal.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="Qué pidió el cliente, qué se le respondió, qué queda pendiente…"
            disabled={saving}
          />
          <Button size="sm" onClick={handleSave} disabled={saving || !text.trim()} className="w-full sm:w-auto">
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Guardar nota
          </Button>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando notas…
          </p>
        ) : notes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            {ticketId ? 'Este caso todavía no tiene notas internas.' : 'Este cliente todavía no tiene notas internas.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-amber-900/80">
                  <Badge variant="outline" className="border-amber-300 bg-amber-100 text-[10px] text-amber-800">
                    {note.note_type === 'indicacion'
                      ? 'Indicación al ATC'
                      : note.ticket_id ? `Caso ${note.ticket_number || 'soporte'}` : 'Cliente'}
                  </Badge>
                  <span className="font-medium">{note.author_name || note.author_email || 'Equipo'}</span>
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