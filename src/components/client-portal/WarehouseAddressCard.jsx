import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Building2, Copy, Check, Warehouse, Phone, User, MapPin } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Parses the warehouse_address config string into structured fields.
 * Expected format (line-based):
 *   广东省台山市...
 *   16号安浦厂房内...
 *   (K100仓库内...
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

  // Reemplazar el placeholder del Nombre con el shipping mark real del usuario
  if (shippingMark) {
    nombre = shippingMark;
  }

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

export default function WarehouseAddressCard({ user, config }) {
  const shippingMark = user?.shipping_mark || '';
  const rawAddress = config?.warehouse_address || '';

  const { addressLines, nombre, zipcode, telefono, instruction } = useMemo(
    () => parseWarehouseAddress(rawAddress, shippingMark),
    [rawAddress, shippingMark]
  );

  const fullAddress = useMemo(() => addressLines.join('\n'), [addressLines]);
  const exampleAddress = useMemo(() => {
    if (!addressLines.length || !shippingMark) return '';
    const first = addressLines[0];
    const last = addressLines[addressLines.length - 1];
    const middle = addressLines.slice(1, -1);
    return [`${shippingMark} ${first}`, ...middle, `${last} ${shippingMark}`].join('\n');
  }, [addressLines, shippingMark]);

  if (!rawAddress) {
    return (
      <div className="flex-1 space-y-2 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6 min-w-0">
        <div className="flex items-center gap-2 text-slate-500 text-xs md:text-sm">
          <Building2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
          Dirección del Warehouse
        </div>
        <p className="text-slate-400 text-xs md:text-sm">Dirección no configurada</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-2 text-slate-500 text-xs md:text-sm">
        <Building2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
        Dirección del Warehouse
      </div>

      {/* Dirección (address lines) */}
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

      {/* Nombre (shipping mark) */}
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

      {/* ZIPCODE + Teléfono row */}
      <div className="grid grid-cols-2 gap-3">
        {zipcode && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">ZIPCODE</span>
              <CopyButton text={zipcode} label="ZIPCODE" />
            </div>
            <p className="text-slate-700 text-xs md:text-sm font-mono break-words">{zipcode}</p>
          </div>
        )}
        {telefono && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <Phone className="h-3 w-3" /> Teléfono
              </span>
              <CopyButton text={telefono} label="Teléfono" />
            </div>
            <p className="text-slate-700 text-xs md:text-sm font-mono break-words">{telefono}</p>
          </div>
        )}
      </div>

      {/* Instruction */}
      {instruction && (
        <p className="text-[11px] text-slate-400 italic">{instruction}</p>
      )}

      {/* Ejemplo con shipping mark al inicio y final */}
      {exampleAddress && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Warehouse className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Ejemplo</span>
          </div>
          <p className="text-slate-700 text-xs md:text-sm whitespace-pre-line break-words">
            {exampleAddress}
          </p>
        </div>
      )}
    </div>
  );
}