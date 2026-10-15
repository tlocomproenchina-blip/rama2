import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, Paperclip, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import useImageViewer from '@/hooks/useImageViewer';
import FileViewerModal from '@/components/common/FileViewerModal';
import { isImageAttachmentUrl, resolveSupportAttachmentUrl } from '@/lib/supportCaseFiles';

const fdate = (value) => (value
  ? new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');

// Todas las fotos y documentos cargados en el caso, juntos y a la vista: lo que
// envió el ATC y lo que sumó el supervisor, con quién y cuándo lo cargó.
export default function SupervisorCaseAttachments({ messages = [] }) {
  const imageViewer = useImageViewer();
  const [viewer, setViewer] = useState(null);
  const [opening, setOpening] = useState('');

  const items = messages.flatMap((msg) => (msg.attachments || []).map((attachment) => ({
    ...attachment,
    sender: msg.sender_name,
    date: msg.timestamp,
  })));

  const photos = items.filter((item) => isImageAttachmentUrl(item));
  const documents = items.filter((item) => !isImageAttachmentUrl(item));

  const openDocument = async (attachment) => {
    setOpening(attachment.url);
    try {
      const url = await resolveSupportAttachmentUrl(attachment);
      if (!url) throw new Error('sin enlace');
      setViewer({ url, name: attachment.name });
    } catch {
      toast.error('No se pudo abrir el archivo');
    }
    setOpening('');
  };

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="h-4 w-4 text-primary" /> Adjuntos del caso
          {items.length > 0 ? <Badge variant="secondary" className="ml-1">{items.length}</Badge> : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {photos.length} foto(s) y {documents.length} documento(s) cargados por el equipo. Los documentos se abren con un enlace temporal.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Todavía no hay fotos ni documentos cargados en este caso.
          </p>
        ) : null}

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((photo, index) => (
              <button
                key={`${photo.url}-${index}`}
                type="button"
                onClick={() => imageViewer.open(photo.url)}
                className="overflow-hidden rounded-xl border border-border/70 bg-card text-left transition hover:opacity-90"
              >
                <img src={photo.url} alt={photo.name || `Adjunto ${index + 1}`} className="h-28 w-full object-cover" />
                <span className="block truncate px-2 py-1 text-[10px] text-muted-foreground">
                  {photo.sender || 'Equipo'} · {fdate(photo.date)}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {documents.length > 0 ? (
          <ul className="space-y-2">
            {documents.map((document, index) => (
              <li key={`${document.url}-${index}`}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 py-2 text-left"
                  onClick={() => openDocument(document)}
                  disabled={opening === document.url}
                >
                  {opening === document.url
                    ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    : <FileText className="h-4 w-4 shrink-0 text-primary" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{document.name || 'Documento'}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {document.sender || 'Equipo'} · {fdate(document.date)}
                      {document.private ? ' · guardado de forma privada' : ''}
                    </span>
                  </span>
                  {document.private ? <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : null}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {imageViewer.modal}
        <FileViewerModal
          open={!!viewer}
          fileUrl={viewer?.url}
          title={viewer?.name || 'Documento'}
          onClose={() => setViewer(null)}
        />
      </CardContent>
    </Card>
  );
}