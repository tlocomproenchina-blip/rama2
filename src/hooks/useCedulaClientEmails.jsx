import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

// Convierte una cédula escrita en el buscador (ej: "V-12345678", "12345678")
// en los correos de los clientes que la tienen. Así cualquier lista que guarde
// el correo del cliente también se puede encontrar por su número de cédula.
// Solo consulta cuando el término parece una cédula, para no gastar llamadas en
// búsquedas normales.
const CEDULA_RE = /^[a-z]{0,3}[-\s]?\d{5,10}$/i;

export function looksLikeCedula(value) {
  const term = String(value || '').trim().replace(/\./g, '');
  return CEDULA_RE.test(term);
}

export default function useCedulaClientEmails(term) {
  const [emails, setEmails] = useState(() => new Set());
  const timerRef = useRef(null);
  const reqRef = useRef(0);

  useEffect(() => {
    clearTimeout(timerRef.current);
    const value = String(term || '').trim();
    if (!looksLikeCedula(value)) {
      setEmails(new Set());
      return;
    }
    timerRef.current = setTimeout(async () => {
      const myReq = ++reqRef.current;
      try {
        const res = await base44.functions.invoke('listClientsForSupport', {
          q: value,
          limit: 50,
          skip: 0,
          includeCounts: false,
        });
        if (myReq !== reqRef.current) return;
        const list = res?.data?.data || [];
        setEmails(new Set(list.map((c) => String(c.email || '').toLowerCase()).filter(Boolean)));
      } catch {
        if (myReq === reqRef.current) setEmails(new Set());
      }
    }, 350);
    return () => clearTimeout(timerRef.current);
  }, [term]);

  return emails;
}