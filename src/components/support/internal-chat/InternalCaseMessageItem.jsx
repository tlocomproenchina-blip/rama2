import React from 'react';
import { Badge } from '@/components/ui/badge';
import useImageViewer from '@/hooks/useImageViewer';
import InternalCaseImage from './InternalCaseImage';

const fdate = (value) => (value
  ? new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');

// Un mensaje del chat interno del caso. Los propios van a la derecha y los de la
// otra parte a la izquierda, igual que en cualquier chat.
export default function InternalCaseMessageItem({ message, currentUserEmail }) {
  const imageViewer = useImageViewer();
  const mine = (message.author_email || '') === (currentUserEmail || '');
  const isSupervisor = message.author_role === 'supervisor';
  const images = message.images || [];

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] rounded-2xl border p-3 ${mine ? 'border-indigo-200 bg-indigo-100/70' : 'border-border/70 bg-card'}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">
            {message.author_name || message.author_email || (isSupervisor ? 'Supervisión' : 'ATC')}
          </span>
          <Badge variant="outline" className="text-[10px]">{isSupervisor ? 'Supervisión' : 'ATC'}</Badge>
          <span>·</span>
          <span>{fdate(message.created_date)}</span>
        </div>

        {message.body ? (
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{message.body}</p>
        ) : null}

        {images.length > 0 ? (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {images.map((image, index) => (
              <InternalCaseImage
                key={`${image.file_uri}-${index}`}
                image={image}
                index={index}
                onOpen={imageViewer.open}
              />
            ))}
          </div>
        ) : null}
      </div>

      {imageViewer.modal}
    </div>
  );
}