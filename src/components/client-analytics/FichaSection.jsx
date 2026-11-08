import React from 'react';
import { Download } from 'lucide-react';

export default function FichaSection({ title, count, onDownload, defaultOpen = true, children }) {
  return (
    <details open={defaultOpen} className="ficha-pan group rounded-[18px] border border-[#ddd4bb] bg-[#fbf8ef] shadow-[0_6px_18px_rgba(38,42,43,.06)] overflow-hidden">
      <summary className="list-none cursor-pointer px-5 py-4 flex items-center gap-2.5 font-[Georgia,serif] text-[19px] font-bold text-[#262a2b] transition-colors duration-200 hover:bg-[#f1ecd9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c8692a] focus-visible:-outline-offset-2 group-open:border-b group-open:border-[#e6dfc8] [&::-webkit-details-marker]:hidden">
        {title}
        {count != null && <span className="font-sans text-xs font-normal text-[#6b6a5b]">({count})</span>}
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