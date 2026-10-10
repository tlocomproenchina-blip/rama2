import React from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import useGuideOrderSources from '@/hooks/useGuideOrderSources';
import useGuideOrderSelection from '@/hooks/useGuideOrderSelection';
import useGuideOrderEmit from '@/hooks/useGuideOrderEmit';
import GuideOrderRow from './GuideOrderRow';
import GuideOrderSelectionSummary from './GuideOrderSelectionSummary';

// Emisión de la guía por N° de orden / envío: la carga entra aunque su bulto no esté
// registrado o no exista. Si la orden tiene bultos registrados, entran con su código;
// si no, la línea sale marcada como carga sin bulto con su N° de orden.
export default function GuideFromOrdersTab({ appName, onGenerated }) {
  const { search, setSearch, orders, loading, reload } = useGuideOrderSources('orders');
  const { selected, toggle, clear, summary } = useGuideOrderSelection();
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
          placeholder="Buscar por N° de orden / envío, cliente o mark"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          No hay órdenes / envíos con esa búsqueda. Las órdenes que ya salieron en una guía como carga sin
          bulto no vuelven a ofrecerse.
        </p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <GuideOrderRow
              key={order.key}
              order={order}
              selected={selected.has(order.key)}
              onToggle={toggle}
            />
          ))}
        </div>
      )}

      <GuideOrderSelectionSummary
        summary={summary}
        emitting={emitting}
        onEmit={handleEmit}
        onClear={clear}
      />
    </div>
  );
}