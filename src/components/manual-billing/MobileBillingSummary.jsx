import React, { useState } from 'react';
import { ChevronUp, ReceiptText } from 'lucide-react';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// El resumen de facturación siempre a la vista en móvil y tablet: una barra fija
// abajo con el total, que se despliega sin tener que bajar hasta el final.
export default function MobileBillingSummary({ total, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 xl:hidden">
      <div className="pointer-events-auto mx-auto max-w-2xl rounded-t-2xl border border-white/10 bg-slate-900/95 shadow-2xl">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ReceiptText className="h-4 w-4 text-sky-400" /> Resumen de facturación
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-base font-semibold text-sky-300">${num(total).toFixed(2)}</span>
            <ChevronUp className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {open && <div className="max-h-[70vh] overflow-y-auto px-3 pb-4">{children}</div>}
      </div>
    </div>
  );
}