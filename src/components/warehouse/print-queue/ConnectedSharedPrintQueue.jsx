import React from 'react';
import useSharedPrintQueue from '@/hooks/useSharedPrintQueue';
import SharedPrintQueuePanel from './SharedPrintQueuePanel';

// Cola compartida con datos reales: estación activa y trabajos de todos los operadores.
export default function ConnectedSharedPrintQueue() {
  const q = useSharedPrintQueue();
  return (
    <SharedPrintQueuePanel
      station={q.station}
      jobs={q.jobs}
      isThisDevice={q.isThisDevice}
      runnerError={q.runner.error}
      loading={q.loading}
      busy={q.busy}
      retryingId={q.retryingId}
      onStart={() => q.start(false)}
      onReconnect={() => q.start(true)}
      onStop={q.stop}
      onRetry={q.retry}
    />
  );
}