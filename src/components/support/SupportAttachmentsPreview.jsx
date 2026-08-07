import React from 'react';
import useImageViewer from '@/hooks/useImageViewer';

export default function SupportAttachmentsPreview({ attachments }) {
  const imageViewer = useImageViewer();
  if (!attachments?.length) return null;

  return (
    <>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {attachments.map((attachment, index) => (
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
      {imageViewer.modal}
    </>
  );
}