import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

// Número visible de la unidad: el del código de etiqueta (-B## / -C##).
export const labelNumber = (b) => {
  const match = String(b?.label_code || '').trim().match(/-[BC](\d+)$/i);
  return match ? Number(match[1]) : Number(b?.bulto_number) || 0;
};

// Número del bulto editable: avisa en rojo si otro bulto o caja ya lo usa.
export default function BultoNumberField({ bulto, value, onChange, error, onAvailability }) {
  const [checking, setChecking] = useState(false);
  const [taken, setTaken] = useState('');
  const number = Math.round(Number(value));
  const valid = Number.isFinite(number) && number >= 1;
  const changed = value !== '' && number !== labelNumber(bulto);

  useEffect(() => {
    setTaken('');
    setChecking(false);
    if (!changed || !valid) {
      onAvailability?.(!changed || valid);
      return undefined;
    }
    onAvailability?.(false);
    setChecking(true);
    const timer = setTimeout(async () => {
      const [byNumber, byLabel] = await Promise.all([
        base44.entities.Bulto.filter({ bulto_number: number, is_caja: { $ne: true } }, '-created_date', 5).catch(() => []),
        base44.entities.Bulto.filter({ label_code: { $regex: `-[BbCc]${number}$` } }, '-created_date', 5).catch(() => []),
      ]);
      const other = [...(byNumber || []), ...(byLabel || [])].find((r) => r.id !== bulto.id);
      setTaken(other ? `El número ${number} no está disponible: lo usa ${other.label_code}` : '');
      onAvailability?.(!other);
      setChecking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [value]);

  const message = error || taken || (value !== '' && !valid ? 'El número debe ser 1 o más' : '');

  return (
    <div>
      <Label className="mb-1 block text-xs">Número de bulto</Label>
      <div className="relative">
        <Input
          type="number"
          min="1"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={message ? 'border-red-500 text-red-600 focus-visible:ring-red-400' : ''}
        />
        {checking && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {message ? (
        <p className="text-[11px] text-red-600 mt-1 font-medium">{message}</p>
      ) : (
        <p className="text-[10px] text-slate-400 mt-1">Solo se acepta un número que ningún otro bulto use. La etiqueta cambia con él.</p>
      )}
    </div>
  );
}