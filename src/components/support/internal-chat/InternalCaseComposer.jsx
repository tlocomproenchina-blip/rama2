import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { toast } from 'sonner';

const MAX_IMAGES = 10;

// Compositor del chat interno: texto y hasta 10 imágenes que se guardan en el
// almacenamiento privado (stored privately).
export default function InternalCaseComposer({ ticket, user, role = 'supervisor', onSent }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  const pickImages = (event) => {
    const picked = Array.from(event.target.files || []).filter((file) => String(file.type).startsWith('image/'));
    event.target.value = '';
    if (picked.length === 0) return;
    const next = [...files, ...picked];
    if (next.length > MAX_IMAGES) {
      toast.error(`Puedes adjuntar hasta ${MAX_IMAGES} imágenes por mensaje`);
      setFiles(next.slice(0, MAX_IMAGES));
      return;
    }
    setFiles(next);
  };

  const removeFile = (index) => setFiles((prev) => prev.filter((_, position) => position !== index));

  const send = async () => {
    const body = text.trim();
    if (!body && files.length === 0) {
      toast.error('Escribe el mensaje o adjunta una imagen');
      return;
    }
    setSending(true);
    try {
      const images = await Promise.all(files.map(async (file) => {
        const res = await base44.integrations.Core.UploadPrivateFile({ file });
        const fileUri = res?.file_uri || res?.data?.file_uri;
        if (!fileUri) throw new Error('No se pudo subir la imagen');
        return { file_uri: fileUri, name: file.name };
      }));

      await base44.entities.InternalCaseMessage.create({
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number || '',
        client_email: ticket.client_email || '',
        atc_email: ticket.escalated_by || user?.email || '',
        atc_name: ticket.escalated_by_name || '',
        author_email: user?.email || '',
        author_name: user?.full_name || user?.email || '',
        author_role: role,
        body,
        images,
      });

      setText('');
      setFiles([]);
      if (onSent) await onSent();
    } catch {
      toast.error('No se pudo enviar el mensaje interno');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-3">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Escribe aquí la información interna del caso. Solo la ve el ATC que escaló y Supervisión."
        rows={3}
        disabled={sending}
        className="resize-none"
      />

      {files.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {files.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-muted px-2 py-1 text-[11px] text-muted-foreground"
            >
              <span className="max-w-[9rem] truncate">{file.name}</span>
              <button type="button" onClick={() => removeFile(index)} aria-label={`Quitar ${file.name}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={pickImages}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={sending || files.length >= MAX_IMAGES}
          >
            <ImagePlus className="mr-1.5 h-3.5 w-3.5" /> Imágenes
          </Button>
          <span className="text-[11px] text-muted-foreground">{files.length}/{MAX_IMAGES}</span>
        </div>

        <Button type="button" size="sm" onClick={send} disabled={sending}>
          {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
          Enviar
        </Button>
      </div>
    </div>
  );
}