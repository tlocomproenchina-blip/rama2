import { useCallback, useEffect, useState } from 'react';
import { formFromRequest } from '@/lib/fiscalForm';

// Estado del formulario con copia local: si el cliente sale a medias, al volver
// recupera lo que había escrito. Se borra la copia al guardar o enviar.
export default function useFiscalForm(request) {
  const storageKey = `fiscal-draft-${request.id}`;
  const [form, setForm] = useState(() => {
    const base = formFromRequest(request);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return { ...base, ...JSON.parse(raw) };
    } catch (_) {}
    return base;
  });

  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(form)); } catch (_) {}
    }, 400);
    return () => clearTimeout(t);
  }, [form, storageKey]);

  const clearLocal = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch (_) {}
  }, [storageKey]);

  return { form, setForm, clearLocal };
}