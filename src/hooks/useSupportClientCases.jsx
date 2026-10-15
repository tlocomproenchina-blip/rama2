import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Casos de soporte del cliente elegido en el asistente. Se cargan una sola vez
// por cliente y se comparten con las tarjetas de indicaciones y seguimiento,
// para que ambas puedan vincular lo que registran a un caso concreto.
export default function useSupportClientCases(clientEmail) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientEmail) {
      setCases([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    base44.entities.SupportTicket.filter({ client_email: clientEmail }, '-created_date', 50)
      .then((rows) => {
        if (active) setCases(rows || []);
      })
      .catch(() => {
        if (active) setCases([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [clientEmail]);

  return { cases, loading };
}