import React from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import useGuideOrderSources from '@/hooks/useGuideOrderSources';
import useGuideOrderSelection from '@/hooks/useGuideOrderSelection';
import useGuideOrderEmit from '@/hooks/useGuideOrderEmit';
import PaidInvoiceOrdersCard from './PaidInvoiceOrdersCard';
import GuideOrderSelectionSummary from './GuideOrderSelectionSummary';
import GuideSearchHint from './GuideSearchHint';

// Emisión de la guía desde una factura pagada: se eligen las contenedores de esa
// factura que se van a despachar. La carga entra aunque su bulto no esté registrado.
export default function GuideFromInvoicesTab({ appName, onGenerated }) {
  const { search, setSearch, invoices, loading, searched, reload } = useGuideOrderSources('invoices');
  const { selected, toggle, toggleMany, clear, summary } = useGuideOrderSelection();
  const { emit, emitting } = useGuideOrderEmit({ appName, onGenerated });

  const handleEmit = async () => {
    const done = await emit([...selected.values()]);
    if (done) {
      clear();
      reload();
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar factura pagada por N° de factura o email del cliente"
          className="pl-9"
        />
      </div>

      {!searched ? (
        <GuideSearchHint text="Escribe el N° de factura o el email del cliente para ver sus contenedores pagados." />
      ) : loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : invoices.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          No hay facturas pagadas con esa búsqueda. Los contenedores que ya salieron en una guía como carga sin
          bulto no vuelven a ofrecerse.
        </p>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <PaidInvoiceOrdersCard
              key={invoice.id}
              invoice={invoice}
              selected={selected}
              onToggleOrder={toggle}
              onToggleMany={toggleMany}
            />
          ))}
        </div>
      )}

      {searched && (
        <GuideOrderSelectionSummary
          summary={summary}
          emitting={emitting}
          onEmit={handleEmit}
          onClear={clear}
        />
      )}
    </div>
  );
}