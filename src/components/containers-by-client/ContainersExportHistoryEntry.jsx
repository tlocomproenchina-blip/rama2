import React, { useState } from 'react';
import moment from 'moment';
import { ChevronDown, ChevronRight, Download, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Una exportación del informe de contenedores: cuándo, quién y qué salió.
export default function ContainersExportHistoryEntry({ entry }) {
  const [open, setOpen] = useState(false);
  const clients = entry.clients || [];
  const isPrint = entry.mode === 'print';

  return (
    <div className="rounded-lg border border-border">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-start gap-2 p-3 text-left">
        {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {moment(entry.exported_date || entry.created_date).format('DD/MM/YYYY HH:mm')}
            </span>
            <Badge variant="outline" className="gap-1 text-[10px]">
              {isPrint ? <Printer className="h-3 w-3" /> : <Download className="h-3 w-3" />}
              {isPrint ? 'Impresión' : 'PDF'}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.clients_count || 0} cliente(s) · {entry.containers_count || 0} contenedor(es) · {entry.bultos_count || 0} bulto(s)
            {entry.exported_by ? ` · ${entry.exported_by}` : ''}
          </p>
        </div>
      </button>

      {open && (
        <div className="space-y-2 border-t border-border px-3 py-2.5">
          {clients.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin detalle guardado de clientes.</p>
          ) : (
            clients.map((client, index) => (
              <div key={`${client.shipping_mark || client.name}-${index}`} className="rounded-md bg-muted/50 p-2">
                <p className="text-xs font-semibold text-foreground">
                  {client.name || 'Cliente sin nombre'}
                  {client.shipping_mark ? <span className="ml-2 font-mono text-[10px] text-muted-foreground">{client.shipping_mark}</span> : null}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(client.containers || []).map((row, rowIndex) => (
                    <Badge key={`${row.container}-${rowIndex}`} variant="secondary" className="font-mono text-[10px]">
                      {row.container} · {Number(row.bultos || 0)} bulto(s)
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}