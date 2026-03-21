import React from 'react';

export default function SupportAttachmentsPreview({ attachments }) {
  if (!attachments?.length) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {attachments.map((attachment, index) => (
        <a
          key={`${attachment.url}-${index}`}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="overflow-hidden rounded-xl border border-border/70 bg-white"
        >
          <img src={attachment.url} alt={attachment.name || `Adjunto ${index + 1}`} className="h-28 w-full object-cover" />
        </a>
      ))}
    </div>
  );
}