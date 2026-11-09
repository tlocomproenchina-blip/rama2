import React from 'react';
import { Loader2, Inbox } from 'lucide-react';
import PrintStationCard from './PrintStationCard';
import PrintJobRow from './PrintJobRow';

// Vista de la cola compartida: la estación activa y los últimos trabajos con su estado.
export default function SharedPrintQueuePanel({
  station, jobs = [], isThisDevice, runnerError, loading, busy, retryingId,
  onStart, onStop, onRetry, onReconnect,
}) {
  const waiting = jobs.filter((j) => j.status === 'pending' || j.status === 'printing').length;
  return (
    <div className="space-y-3">
      <PrintStationCard
        station={station}
        isThisDevice={isThisDevice}
        runnerError={runnerError}
        busy={busy}
        onStart={onStart}
        onStop={onStop}
        onReconnect={onReconnect}
      />
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cola compartida</p>
        <p className="text-xs text-muted-foreground">{waiting} en curso</p>
      </div>
      {loading && !jobs.length ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : jobs.length ? (
        <div className="space-y-2">
          {jobs.map((job) => (
            <PrintJobRow key={job.id} job={job} onRetry={onRetry} retrying={retryingId === job.id} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border py-6 text-center">
          <Inbox className="h-5 w-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Aún no hay trabajos en la cola</p>
        </div>
      )}
    </div>
  );
}