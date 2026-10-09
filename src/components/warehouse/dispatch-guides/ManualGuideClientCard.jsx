import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronUp } from 'lucide-react';

const fmtDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-VE');
};

// Un cliente con bultos pendientes de guía: se puede marcar el cliente completo o
// elegir bulto por bulto dentro de su detalle.
export default function ManualGuideClientCard({ client, selectedCodes, onToggleBulto, onToggleClient }) {
  const [open, setOpen] = useState(false);
  const bultos = Array.isArray(client.bultos) ? client.bultos : [];
  const codes = bultos.map((bulto) => bulto.label_code);
  const selected = codes.filter((code) => selectedCodes.has(code));
  const allSelected = codes.length > 0 && selected.length === codes.length;
  const packages = bultos
    .filter((bulto) => selectedCodes.has(bulto.label_code))
    .reduce((sum, bulto) => sum + (Number(bulto.package_count) || 0), 0);

  return (
    <div className="rounded-xl border border-border/70 p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={allSelected ? true : selected.length ? 'indeterminate' : false}
          onCheckedChange={() => onToggleClient(client)}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 break-all">
            {String(client.client_name || client.client_email || 'Cliente').replace(/^Sin registrar(?= —|$)/i, 'Cliente')}
          </p>
          <p className="font-mono text-[11px] text-blue-700 break-all">
            Mark: {client.shipping_mark || client.client?.shipping_mark || '—'}
          </p>
          <p className="text-[11px] text-slate-500">
            {bultos.length} bulto(s) pendiente(s)
            {selected.length ? ` · ${selected.length} marcado(s) · ${packages} paquete(s)` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border/70 px-2 py-1 text-[11px] font-semibold text-slate-600"
        >
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Bultos
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
          {bultos.map((bulto) => (
            <label
              key={bulto.label_code}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 hover:bg-accent/60"
            >
              <Checkbox
                checked={selectedCodes.has(bulto.label_code)}
                onCheckedChange={() => onToggleBulto(bulto.label_code)}
              />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] font-semibold text-slate-800 break-all">
                  {bulto.caja_number ? `[${bulto.caja_number}/${bulto.caja_total || '?'}] ` : ''}
                  {bulto.label_code}
                </p>
                <p className="text-[10px] text-slate-500">
                  {Number(bulto.package_count) || 0} paquete(s)
                  {bulto.is_caja ? ' · caja' : ''}
                  {bulto.cbm ? ` · ${Number(bulto.cbm).toFixed(3)} CBM` : ''}
                  {bulto.date ? ` · ${fmtDate(bulto.date)}` : ''}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}