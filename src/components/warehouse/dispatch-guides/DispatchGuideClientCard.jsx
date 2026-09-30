import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';

// Un cliente con los códigos de todos sus bultos del rango filtrado. Al marcarlo,
// la guía incluye todos sus bultos, sin dejar ninguno fuera.
export default function DispatchGuideClientCard({ client, selected, onToggle }) {
  const bultos = Array.isArray(client.bultos) ? client.bultos : [];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={`block rounded-xl border p-3 cursor-pointer transition-all ${
        selected ? 'border-blue-400 bg-blue-50/70' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-slate-800 break-all">{client.client_name || client.client_email}</p>
            <span className="text-xs text-slate-500">
              {client.totals?.bultos || 0} bulto(s) · {client.totals?.packages || 0} paquete(s)
            </span>
          </div>
          <p className="font-mono text-xs text-blue-700 mt-0.5 break-all">
            Mark: {client.shipping_mark || client.client?.shipping_mark || '—'}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {bultos.map((bulto) => (
              <span
                key={`${bulto.label_code}-${bulto.order_number}`}
                className={`rounded-lg border px-2 py-0.5 font-mono text-[11px] ${
                  bulto.registered
                    ? 'border-slate-200 bg-white/80 text-slate-700'
                    : 'border-amber-300 bg-amber-50 text-amber-700'
                }`}
              >
                {bulto.label_code} · {bulto.package_count || 0} paq.
                {!bulto.registered && ' · verificar'}
              </span>
            ))}
          </div>

          {client.totals?.unregistered > 0 && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-700">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {client.totals.unregistered} código(s) escaneado(s) sin bulto registrado: verificar antes de entregar
            </p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">
            {client.totals?.scanned || client.totals?.bultos || 0} escaneo(s) para despacho en el rango
          </p>
        </div>
      </div>
    </div>
  );
}