import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Search, Check } from 'lucide-react';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, splitPhoneNumber } from '@/lib/countryCodes';
import { cn } from '@/lib/utils';

/**
 * Campo combinado para WhatsApp: selector de prefijo país (con buscador) + número.
 * Siempre devuelve el valor en formato +<prefijo><número>.
 *
 * Props:
 * - value: string (ej. "+584121234567")
 * - onChange: (newValue: string) => void
 * - placeholder, error, id, className
 */
export default function WhatsAppInput({ value, onChange, placeholder = '412 1234567', error, id, className }) {
  const initial = useMemo(() => splitPhoneNumber(value, DEFAULT_COUNTRY_CODE), []);
  const [code, setCode] = useState(initial.code);
  const [number, setNumber] = useState(initial.number);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);

  // Si el value externo cambia (ej. al abrir un modal con datos previos), re-sincronizar
  useEffect(() => {
    const parsed = splitPhoneNumber(value, code);
    if (parsed.code !== code) setCode(parsed.code);
    if (parsed.number !== number) setNumber(parsed.number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const emit = (nextCode, nextNumber) => {
    const digits = String(nextNumber || '').replace(/\D/g, '');
    onChange(digits ? `${nextCode}${digits}` : '');
  };

  const handleCodeSelect = (newCode) => {
    setCode(newCode);
    setOpen(false);
    setSearch('');
    emit(newCode, number);
  };

  const handleNumberChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    setNumber(digits);
    emit(code, digits);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    return COUNTRY_CODES.filter((c) =>
      c.country.toLowerCase().includes(q) || c.code.includes(q)
    );
  }, [search]);

  return (
    <div className={cn('flex gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'flex h-auto min-h-[48px] sm:min-h-10 items-center gap-1 px-3 font-mono text-sm shrink-0',
              error && 'border-red-300'
            )}
          >
            {code}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar país o código..."
                className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-500">Sin resultados</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code + c.country}
                  type="button"
                  onClick={() => handleCodeSelect(c.code)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-slate-100 text-left"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{c.flag}</span>
                    <span className="truncate text-slate-700">{c.country}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs text-slate-500">{c.code}</span>
                    {c.code === code && <Check className="h-3.5 w-3.5 text-green-600" />}
                  </span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Input
        id={id}
        value={number}
        onChange={handleNumberChange}
        onInvalid={(e) => e.preventDefault()}
        placeholder={placeholder}
        inputMode="numeric"
        type="text"
        className={cn('flex-1', error && 'border-red-300')}
      />
    </div>
  );
}