import React from 'react';
import { Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Client360Section from './Client360Section';

export default function Client360Recibos({ recibos }) {
  return (
    <Client360Section icon={Receipt} title="Recibos (CBM)" count={recibos.length}>
      {recibos.map((r) => (
        <div key={r.id} className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-slate-800 truncate">
              {r.invoice_number ? `Recibo ${r.invoice_number}` : (r.descripcion || 'Sin referencia')}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {r.fecha ? new Date(r.fecha).toLocaleDateString('es-VE') : ''} · {(r.tracking_numbers || []).length} trackings
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">{Number(r.cbm || 0).toFixed(4)} CBM</span>
          {r.disponible_entrega && (
            <Badge className="text-[10px] bg-green-100 text-green-700">Disponible</Badge>
          )}
        </div>
      ))}
    </Client360Section>
  );
}