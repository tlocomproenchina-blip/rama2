import React from 'react';
import { Download } from 'lucide-react';

export default function FichaSection({ title, count, onDownload, defaultOpen = true, children }) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <summary className="list-none cursor-pointer px-4 sm:px-5 py-4 flex items-center gap-2.5 font-display text-base sm:text-lg font-bold text-foreground transition-colors duration-200 hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring group-open:border-b group-open:border-border [&::-webkit-details-marker]:hidden">
        <span className="h-5 w-1 rounded-full bg-primary shrink-0" />
        {title}
        {count != null && <span className="font-sans text-xs font-medium text-muted-foreground">({count})</span>}
        {onDownload && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onDownload(); }}
            className="ficha-btn ml-auto h-[34px] px-3 text-[13px]"
          >
            <Download className="h-4 w-4" /> Excel
          </button>
        )}
      </summary>
      <div className="p-3 sm:p-5">{children}</div>
    </details>
  );
}