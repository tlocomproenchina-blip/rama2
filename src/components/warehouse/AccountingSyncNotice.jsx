import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Aviso claro para el almacén de Venezuela cuando el N° de contenedor del bulto no pudo
// aplicarse al recibo de contabilidad porque otro recibo ya usa ese número.
export default function AccountingSyncNotice({ messages = [] }) {
  const list = (messages || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      <p className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" /> Contabilidad no quedó alineada
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-6">
        {list.map((message, index) => (
          <li key={index}>{message}</li>
        ))}
      </ul>
    </div>
  );
}