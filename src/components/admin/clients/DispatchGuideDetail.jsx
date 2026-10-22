import React from 'react';
import { isUnregisteredLine } from '@/lib/dispatchGuides';

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-VE');
};

// Detalle de solo lectura de una guía: cada cliente con sus bultos/cajas y N° de contenedor.
export default function DispatchGuideDetail({ guide }) {
  const clients = Array.isArray(guide.clients) ? guide.clients : [];
  const orders = Array.isArray(guide.dispatch_orders) ? guide.dispatch_orders : [];

  if (clients.length === 0) {
    return <p className="text-xs text-slate-400">Esta guía no tiene detalle guardado.</p>;
  }

  return (
    <div className="space-y-3">
      {orders.length > 0 && (
        <p className="text-xs text-slate-600">
          <span className="font-semibold">Órdenes de despacho:</span>{' '}
          {orders.map((o) => o.order_number).filter(Boolean).join(' · ') || '—'}
        </p>
      )}
      {clients.map((client) => {
        const bultos = Array.isArray(client.bultos) ? client.bultos : [];
        const name = String(client.client_name || client.client_email || 'Cliente').replace(/^Sin registrar(?= —|$)/i, 'Cliente');
        return (
          <div key={client.client_key || client.client_email || name} className="rounded-xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-800 break-words">{name}</p>
            <p className="font-mono text-[11px] text-blue-700 break-all">
              Mark: {client.shipping_mark || client.client?.shipping_mark || '—'}
            </p>
            <ul className="mt-2 divide-y divide-slate-100">
              {bultos.map((b, i) => (
                <li key={`${b.label_code || b.order_number || 'l'}-${i}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5 text-xs">
                  <div className="min-w-0">
                    {isUnregisteredLine(b) ? (
                      <span className="font-semibold text-amber-700">SIN BULTO · Contenedor {b.order_number || '—'}</span>
                    ) : (
                      <span className="font-mono font-semibold text-slate-800 break-all">
                        {b.caja_number ? `[${b.caja_number}/${b.caja_total || '?'}] ` : ''}{b.label_code}
                      </span>
                    )}
                    {!isUnregisteredLine(b) && b.order_number && (
                      <span className="ml-2 text-slate-500">Contenedor {b.order_number}</span>
                    )}
                  </div>
                  <span className="text-slate-500">
                    {b.package_count ?? 0} paq.{b.cbm ? ` · ${Number(b.cbm).toFixed(3)} CBM` : ''}{b.date ? ` · ${fmtDate(b.date)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}