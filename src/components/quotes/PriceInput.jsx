import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Input de precio que acepta "." y "," como separador decimal indistintamente.
 * Arranca vacío (sin el 0 por defecto) y preserva el texto crudo mientras se escribe
 * para que la coma no se pierda a mitad del tipeo.
 */
export default function PriceInput({ value, onChange, readOnly, placeholder = '0.00', className }) {
  const [raw, setRaw] = useState('');
  const rawRef = useRef('');

  // Sincroniza desde el valor numérico externo solo cuando cambia por fuera
  useEffect(() => {
    const num = Number(value);
    if (!value || isNaN(num)) {
      if (rawRef.current !== '') {
        setRaw('');
        rawRef.current = '';
      }
      return;
    }
    const parsedRaw = rawRef.current === '' ? NaN : Number(rawRef.current.replace(',', '.'));
    if (parsedRaw !== num) {
      const str = String(num);
      setRaw(str);
      rawRef.current = str;
    }
  }, [value]);

  const handleChange = (e) => {
    let v = e.target.value;
    // Solo dígitos y un separador (.,)
    let normalized = v.replace(/[^0-9.,]/g, '');
    const firstSep = normalized.search(/[.,]/);
    if (firstSep !== -1) {
      normalized =
        normalized.slice(0, firstSep + 1) +
        normalized.slice(firstSep + 1).replace(/[.,]/g, '');
    }
    setRaw(normalized);
    rawRef.current = normalized;
    const parsed =
      normalized === '' || normalized === '.' || normalized === ','
        ? 0
        : Number(normalized.replace(',', '.'));
    onChange(isNaN(parsed) ? 0 : parsed);
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={raw}
      readOnly={readOnly}
      onChange={handleChange}
      className={className}
    />
  );
}