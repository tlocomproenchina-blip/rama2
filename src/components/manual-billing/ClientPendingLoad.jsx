import React, { useMemo } from 'react';
import { PackageSearch } from 'lucide-react';
import PendingBillingOrderGroup from './PendingBillingOrderGroup';
import PendingBillingMarkedBultos from './PendingBillingMarkedBultos';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const ordersOf = (bulto) => {
  const orders = [...new Set((bulto.order_numbers || []).filter(Boolean).map((o) => String(o).trim()))];
  return orders.length ? orders : [''];
};

// Carga del cliente que sigue en el almacén sin facturar, agrupada por N° de orden.
// Solo existen los grupos con bultos pendientes: un N° de orden que ya no tiene carga
// no se dibuja, así el expediente queda solo con lo que hay que trabajar. Los bultos
// marcados como ya facturados viven aparte, plegados, para poder devolverlos.
export default function ClientPendingLoad({ client, markingId, onMarkBulto, onMarkOrderBultos }) {
  const bultos = client?.bultos || [];
  const receipts = client?.receipts || [];

  const pendingBultos = useMemo(() => bultos.filter((b) => !b.billing_marked), [bultos]);
  const markedBultos = useMemo(() => bultos.filter((b) => b.billing_marked), [bultos]);

  const groups = useMemo(() => {
    const map = new Map();
    const ensure = (key) => {
      const clean = String(key || '').trim();
      if (!map.has(clean)) map.set(clean, { order: clean, bultos: [], receipts: [], markedBultos: [] });
      return map.get(clean);
    };

    // Los grupos nacen solo de los bultos pendientes
    for (const bulto of pendingBultos) {
      const orders = [...new Set((bulto.order_numbers || []).filter(Boolean).map((o) => String(o).trim()))];
      if (orders.length === 0) {
        ensure('').bultos.push({ bulto, shared: false });
        continue;
      }
      // Si el bulto trae más de un N° de orden aparece en cada uno, para que ningún
      // envío quede incompleto al facturarlo.
      for (const order of orders) ensure(order).bultos.push({ bulto, shared: orders.length > 1 });
    }

    // Los bultos marcados solo se cuelgan de un grupo que ya existe (para saber si el
    // envío va parcial); no crean grupos nuevos ni bloques vacíos.
    for (const bulto of markedBultos) {
      for (const order of ordersOf(bulto)) {
        const group = map.get(order);
        if (group) group.markedBultos.push(bulto);
      }
    }

    // El recibo de referencia se muestra dentro del grupo de un bulto que lo contiene,
    // o en su propio N° de orden cuando ese grupo existe.
    const orderByBultoLabel = new Map();
    for (const group of map.values()) {
      for (const item of group.bultos) {
        if (!orderByBultoLabel.has(item.bulto.label)) orderByBultoLabel.set(item.bulto.label, group.order);
      }
    }
    for (const receipt of receipts) {
      const own = map.get(String(receipt.label || '').trim());
      if (own) {
        own.receipts.push(receipt);
        continue;
      }
      const key = orderByBultoLabel.get(receipt.in_bulto);
      if (key !== undefined) ensure(key).receipts.push(receipt);
    }

    const cbmOf = (group) => group.bultos.reduce((sum, item) => sum + num(item.bulto.cbm), 0);
    return [...map.values()].sort((a, b) => {
      if (!a.order) return 1;
      if (!b.order) return -1;
      if (cbmOf(b) !== cbmOf(a)) return cbmOf(b) - cbmOf(a);
      return a.order.localeCompare(b.order);
    });
  }, [pendingBultos, markedBultos, receipts]);

  const pendingPackages = pendingBultos.reduce((sum, b) => sum + num(b.package_count), 0);
  const pendingCbm = pendingBultos.reduce((sum, b) => sum + num(b.cbm), 0);

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90">
            Carga en almacén · N° de orden
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Marca el envío completo cuando ya se facturó por fuera: sale de aquí y queda en 'Envíos ya facturados'.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className="rounded-full bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-300 ring-1 ring-inset ring-sky-500/30">
            {pendingBultos.length} bulto(s)
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300 ring-1 ring-inset ring-white/10">
            {pendingPackages} paquete(s)
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300 ring-1 ring-inset ring-white/10">
            {pendingCbm.toFixed(4)} CBM
          </span>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-300">
          <PackageSearch className="h-4 w-4 shrink-0 text-slate-500" />
          Este cliente no tiene bultos pendientes de facturar en el almacén.
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <PendingBillingOrderGroup
              key={group.order || 'sin-orden'}
              group={group}
              markingId={markingId}
              onMarkBulto={onMarkBulto}
              onMarkOrderBultos={onMarkOrderBultos}
            />
          ))}
        </div>
      )}

      <PendingBillingMarkedBultos
        bultos={markedBultos}
        markingId={markingId}
        onMarkBulto={onMarkBulto}
        onMarkOrderBultos={onMarkOrderBultos}
      />
    </div>
  );
}