import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
const isNumericQuery = (value) => digitsOnly(value).length >= 5 && !/[a-z]/i.test(String(value || ''));

// El ATC suele copiar el número tal como lo ve (0414…) mientras el cliente lo
// tiene guardado con el código del país (58414…). Se prueban las dos formas.
function phoneVariants(raw) {
  const digits = digitsOnly(raw);
  if (digits.startsWith('58')) return [`0${digits.slice(2)}`];
  if (digits.startsWith('0')) return [`58${digits.slice(1)}`];
  return [];
}

// Búsqueda del cliente + conversación guiada con el asistente.
export default function useSupportAssistant() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [client, setClient] = useState(null);
  const [context, setContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [turns, setTurns] = useState([]);
  const [asking, setAsking] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const search = useCallback(async (raw) => {
    const value = String(raw ?? '').trim();
    if (value.length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const terms = isNumericQuery(value) ? [digitsOnly(value), ...phoneVariants(value)] : [value];
      let found = [];
      for (const term of terms) {
        const res = await base44.functions.invoke('listClientsForSupport', { q: term, limit: 8, includeCounts: false });
        if (res?.data?.error) throw new Error(res.data.error);
        found = res?.data?.data || [];
        if (found.length) break;
      }
      setResults(found);
    } catch (error) {
      toast.error(error?.message || 'No se pudo buscar el cliente');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const selectClient = useCallback(async (picked) => {
    setClient(picked);
    setContext(null);
    setTurns([]);
    setResults([]);
    setLoadingContext(true);
    try {
      const res = await base44.functions.invoke('supportAssistant', { action: 'context', client_email: picked.email });
      if (res?.data?.error) throw new Error(res.data.error);
      setContext(res.data.context);
    } catch (error) {
      toast.error(error?.message || 'No se pudo cargar el historial del cliente');
    } finally {
      setLoadingContext(false);
    }
  }, []);

  const clearClient = useCallback(() => {
    setClient(null);
    setContext(null);
    setTurns([]);
  }, []);

  const ask = useCallback(
    async (raw) => {
      if (!client) return;
      const question = String(raw || '').trim();
      if (!question) return;
      setAsking(true);
      try {
        const history = turns.flatMap((turn) => [
          { role: 'cliente', text: turn.question },
          { role: 'asistente', text: `${turn.answer.paso_a_seguir}\nRespuesta enviada: ${turn.answer.respuesta_sugerida}` },
        ]);
        const res = await base44.functions.invoke('supportAssistant', {
          action: 'ask',
          client_email: client.email,
          question,
          history,
        });
        if (res?.data?.error) throw new Error(res.data.error);
        setTurns((prev) => [...prev, { question, answer: res.data.answer, at: new Date().toISOString() }]);
      } catch (error) {
        toast.error(error?.message || 'El asistente no pudo responder');
      } finally {
        setAsking(false);
      }
    },
    [client, turns]
  );

  const escalate = useCallback(
    async (payload) => {
      if (!client) return null;
      setEscalating(true);
      try {
        const transcript = turns.flatMap((turn) => [
          { label: 'Cliente', text: turn.question },
          { label: 'Asistente · paso a seguir', text: turn.answer.paso_a_seguir },
          { label: 'Asistente · respuesta sugerida', text: turn.answer.respuesta_sugerida },
        ]);
        const res = await base44.functions.invoke('supportAssistant', {
          action: 'escalate',
          client_email: client.email,
          transcript,
          ...payload,
        });
        if (res?.data?.error) throw new Error(res.data.error);
        toast.success(`Ticket ${res.data.ticket_number} creado y asignado a supervisión`);
        return res.data;
      } catch (error) {
        toast.error(error?.message || 'No se pudo escalar el caso');
        return null;
      } finally {
        setEscalating(false);
      }
    },
    [client, turns]
  );

  return {
    query,
    setQuery,
    search,
    searching,
    results,
    client,
    context,
    loadingContext,
    selectClient,
    clearClient,
    turns,
    ask,
    asking,
    escalate,
    escalating,
  };
}