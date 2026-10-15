import React, { useState } from 'react';
import useImageViewer from '@/hooks/useImageViewer';
import FileViewerModal from '@/components/common/FileViewerModal';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isImageAttachmentUrl, resolveSupportAttachmentUrl } from '@/lib/supportCaseFiles';

// Adjuntos de un mensaje del ticket: las fotos se ven en miniatura y los
// documentos y PDF se abren con un enlace temporal (guardados de forma privada).
export default function SupportAttachmentsPreview({ attachments }) {
  const imageViewer = useImageViewer();
  const [viewer, setViewer] = useState(null);
  const [opening, setOpening] = useState('');

  if (!attachments?.length) return null;

  const photos = attachments.filter((attachment) => isImageAttachmentUrl(attachment));
  const documents = attachments.filter((attachment) => !isImageAttachmentUrl(attachment));

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
    <>
      {photos.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {photos.map((attachment, index) => (
            <button
              key={`${attachment.url}-${index}`}
              type="button"
              onClick={() => imageViewer.open(attachment.url)}
              className="overflow-hidden rounded-xl border border-border/70 bg-white cursor-pointer hover:opacity-90 transition-opacity"
            >
              <img src={attachment.url} alt={attachment.name || `Adjunto ${index + 1}`} className="h-28 w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {documents.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {documents.map((attachment, index) => (
            <li key={`${attachment.url}-${index}`}>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-auto max-w-full justify-start gap-2 py-1.5 text-left"
                onClick={() => openDocument(attachment)}
                disabled={opening === attachment.url}
              >
                {opening === attachment.url
                  ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  : <FileText className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate text-xs">{attachment.name || 'Documento'}</span>
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
    </>
  );
}