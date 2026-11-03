import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Etiquetas, saldo pendiente y casos abiertos del cliente abierto en el CRM.
export default function useCrmClientSummary(email) {
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    if (!email) { setSummary(null); return; }
    const res = await base44.functions.invoke('supportCrm', { action: 'client', email });
    setSummary(res.data);
  }, [email]);

  useEffect(() => { setSummary(null); load(); }, [load]);

  return { summary, reload: load };
}