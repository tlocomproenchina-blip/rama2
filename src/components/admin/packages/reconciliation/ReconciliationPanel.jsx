import React, { useState } from 'react';
import moment from 'moment';
import { Database, ScanLine, ChevronDown, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePackageReconciliation } from '@/hooks/usePackageReconciliation';
import ReconciliationSourceCard from './ReconciliationSourceCard';
import ReconciliationDiffSummary from './ReconciliationDiffSummary';
import ReconciliationIssueList from './ReconciliationIssueList';
import ReconciliationPeriodPicker from './ReconciliationPeriodPicker';
import { buildIssueGroups } from './reconciliationGroups';

export default function ReconciliationPanel() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const { data, isLoading, isFetching, error, refetch } = usePackageReconciliation(days, open);

  return (
    <section className="rounded-[1.5rem] border border-border/70 bg-card/95 shadow-card">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-link">Conciliación</p>
          <h2 className="font-display text-lg font-semibold text-foreground">Registros vs. escaneos físicos</h2>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 px-4 pb-5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ReconciliationPeriodPicker value={days} onChange={setDays} />
            <div className="flex items-center gap-2">
              {data?.generated_at && <span className="text-[11px] text-muted-foreground">Calculado {moment(data.generated_at).format('HH:mm:ss')}</span>}
              <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />Actualizar
              </Button>
            </div>
          </div>
          {isLoading && <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Conciliando registros y escaneos…</div>}
          {error && !data && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">No se pudo calcular la conciliación. Intenta actualizar.</p>}
          {data && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <ReconciliationSourceCard icon={Database} eyebrow="Fuente 1" title="Registros de paquetes" total={data.records.received_in_period} totalLabel={`recibidos en ${data.period.days} días`}
                  rows={[{ label: 'Con escaneo de bodega', value: data.records.with_scan, tone: 'ok' }, { label: 'Sin escaneo de bodega', value: data.records.without_scan, tone: 'muted', hint: 'Recepción manual u otra vía' }, { label: 'Registros duplicados', value: data.match.duplicate_records, tone: data.match.duplicate_records ? 'warn' : 'muted' }]} />
                <ReconciliationSourceCard icon={ScanLine} eyebrow="Fuente 2" title="Escaneos físicos de bodega" total={data.scans.unique_trackings} totalLabel="códigos únicos escaneados"
                  rows={[{ label: 'Escaneos totales', value: data.scans.total_scans }, { label: 'Repetidos (no suman)', value: data.scans.repeated_scans, tone: 'muted' }, { label: 'Sin recepción en sistema', value: data.match.scanned_not_received, tone: data.match.scanned_not_received ? 'bad' : 'muted' }, { label: 'Sin registro de paquete', value: data.match.scanned_without_record, tone: data.match.scanned_without_record ? 'bad' : 'muted' }]} />
              </div>
              <ReconciliationDiffSummary data={data} />
              <ReconciliationIssueList key={days} groups={buildIssueGroups(data)} />
            </>
          )}
        </div>
      )}
    </section>
  );
}