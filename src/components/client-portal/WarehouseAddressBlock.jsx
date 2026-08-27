import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, Warehouse, Phone, User, MapPin } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Parsea el texto de dirección del almacén en campos estructurados.
 * Formato esperado (por líneas):
 *   广东省台山市...
 *   Nombre: N*-TLEC-******
 *   ZIPCODE: 529200
 *   Teléfono: 13427313128
 *   Por favor agrega tu Shipping Mark...
 */
function parseWarehouseAddress(raw, shippingMark) {
  const lines = (raw || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const addressLines = [];
  let nombre = '';
  let zipcode = '';
  let telefono = '';
  let instruction = '';

  for (const line of lines) {
    if (/^nombre\s*:/i.test(line)) {
      nombre = line.replace(/^nombre\s*:\s*/i, '').trim();
    } else if (/^zipcode\s*:/i.test(line)) {
      zipcode = line.replace(/^zipcode\s*:\s*/i, '').trim();
    } else if (/^tel[eé]fono\s*:/i.test(line)) {
      telefono = line.replace(/^tel[eé]fono\s*:\s*/i, '').trim();
    } else if (/^por favor/i.test(line)) {
      instruction = line;
    } else {
      addressLines.push(line);
    }
  }

  if (shippingMark) nombre = shippingMark;

  return { addressLines, nombre, zipcode, telefono, instruction };
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copiado`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('No se pudo copiar');
    }
  };
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-7 w-7 flex-shrink-0"
      onClick={handleCopy}
      title={`Copiar ${label}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

/**
 * Muestra los datos de UN almacén (dirección, nombre/shipping mark, zipcode, teléfono
 * y el ejemplo de cómo debe verse la dirección de envío).
 */
export default function WarehouseAddressBlock({ name, address, phone, zipcode, shippingMark }) {
  const parsed = useMemo(() => parseWarehouseAddress(address, shippingMark), [address, shippingMark]);
  const addressLines = parsed.addressLines;
  const nombre = parsed.nombre;
  const finalZip = zipcode || parsed.zipcode || '';
  const finalPhone = phone || parsed.telefono || '';
  const instruction = parsed.instruction;

  const fullAddress = useMemo(() => addressLines.join('\n'), [addressLines]);
  const exampleAddress = useMemo(() => {
    if (!addressLines.length || !shippingMark) return '';
    const first = addressLines[0];
    const last = addressLines[addressLines.length - 1];
    const middle = addressLines.slice(1, -1);
    return [`${shippingMark} ${first}`, ...middle, `${last} ${shippingMark}`].join('\n');
  }, [addressLines, shippingMark]);

  if (!address) return null;

  return (
    <div className="space-y-3">
      {name && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">
            <Warehouse className="h-3 w-3" /> Almacén {name}
          </span>
        </div>
      )}

      {addressLines.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <MapPin className="h-3 w-3" /> Dirección
            </span>
            <CopyButton text={fullAddress} label="Dirección" />
          </div>
          <p className="text-slate-700 text-xs md:text-sm whitespace-pre-line break-words">
            {fullAddress}
          </p>
        </div>
      )}

      {nombre && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <User className="h-3 w-3" /> Nombre
            </span>
            <CopyButton text={nombre} label="Nombre" />
          </div>
          <p className="text-slate-700 text-xs md:text-sm font-mono font-semibold break-words">
            {nombre}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {finalZip && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">ZIPCODE</span>
              <CopyButton text={finalZip} label="ZIPCODE" />
            </div>
            <p className="text-slate-700 text-xs md:text-sm font-mono break-words">{finalZip}</p>
          </div>
        )}
        {finalPhone && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <Phone className="h-3 w-3" /> Teléfono
              </span>
              <CopyButton text={finalPhone} label="Teléfono" />
            </div>
            <p className="text-slate-700 text-xs md:text-sm font-mono break-words">{finalPhone}</p>
          </div>
        )}
      </div>

      {instruction && <p className="text-[11px] text-slate-400 italic">{instruction}</p>}

      {exampleAddress && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Warehouse className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Tu dirección de envío se debe ver así</span>
          </div>
          <p className="text-slate-700 text-xs md:text-sm whitespace-pre-line break-words">
            {exampleAddress}
          </p>
        </div>
      )}
    </div>
  );
}