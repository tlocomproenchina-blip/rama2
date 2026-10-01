import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Mail, MapPin, Phone } from 'lucide-react';
import PendingBillingOrderGroup from './PendingBillingOrderGroup';
import PendingBillingMarkedBultos from './PendingBillingMarkedBultos';

// Un cliente del panel: sus datos, el resumen de su carga y una pestaña por
// N° de orden/envío con todos sus bultos juntos, porque se facturan y se despachan juntos.
export default function PendingBillingClientCard({ client, selected, markingId, onSelect, onMarkBulto, onMarkOrderBultos }) {
  const bultos = client.bultos || [];
  const receipts = client.receipts || [];

  // Los bultos marcados como ya facturados salen de las pestañas: se conservan abajo,
  // en verde y agrupados por su N° de orden, con la casilla para devolverlos.
  const pendingBultos = useMemo(() => bultos.filter((b) => !b.billing_marked), [bultos]);
  const markedBultos = useMemo(() => bultos.filter((b) => b.billing_marked), [bultos]);

  // Pestañas: una por N° de orden/envío con sus bultos y su recibo de referencia.
  // Los bultos sin N° de orden quedan en su propia pestaña para no perderlos de vista.
  const groups = useMemo(() => {
    const map = new Map();
    const ensure = (key) => {
      const clean = String(key || '').trim();
      if (!map.has(clean)) map.set(clean, { order: clean, bultos: [], receipts: [], markedBultos: [] });
      return map.get(clean);
    };

    for (const bulto of pendingBultos) {
      const orders = [...new Set((bulto.order_numbers || []).filter(Boolean).map((o) => String(o).trim()))];
      if (orders.length === 0) {
        ensure('').bultos.push({ bulto, shared: false });
        continue;
      }
      // Si el bulto trae más de un N° de orden, aparece en cada uno para que ningún
      // envío quede incompleto al facturarlo.
      for (const order of orders) ensure(order).bultos.push({ bulto, shared: orders.length > 1 });
    }

    // Los ya marcados de cada N° de orden: con ellos la pestaña sabe si el envío está
    // completo o solo parcial, y su casilla maestra marca lo que falta.
    const ordersOf = (bulto) => {
      const orders = [...new Set((bulto.order_numbers || []).filter(Boolean).map((o) => String(o).trim()))];
      return orders.length ? orders : [''];
    };
    for (const bulto of markedBultos) {
      for (const order of ordersOf(bulto)) ensure(order).markedBultos.push(bulto);
    }

    // Un envío (recibo de CBM) se muestra solo dentro de la pestaña de un bulto: si su
    // propio N° de orden no tiene bultos, se cuelga del bulto que lo contiene. Sin bulto
    // asignado no se muestra, porque no es carga del almacén.
    const orderByBultoLabel = new Map();
    for (const g of map.values()) {
      for (const item of [...g.bultos.map((x) => x.bulto), ...g.markedBultos]) {
        if (!orderByBultoLabel.has(item.label)) orderByBultoLabel.set(item.label, g.order);
      }
    }
    for (const r of receipts) {
      const own = map.get(String(r.label || '').trim());
      if (own && (own.bultos.length > 0 || own.markedBultos.length > 0)) {
        own.receipts.push(r);
        continue;
      }
      const key = orderByBultoLabel.get(r.in_bulto);
      if (key !== undefined) ensure(key).receipts.push(r);
    }

    const cbmOf = (g) => g.bultos.reduce((sum, item) => sum + Number(item.bulto.cbm || 0), 0);
    return [...map.values()].sort((a, b) => {
      if (!a.order) return 1;
      if (!b.order) return -1;
      if (cbmOf(b) !== cbmOf(a)) return cbmOf(b) - cbmOf(a);
      return a.order.localeCompare(b.order);
    });
  }, [pendingBultos, receipts, markedBultos]);

  return (
    <div className={`rounded-xl border p-3 space-y-2 transition-colors ${
      selected ? 'border-primary/50 bg-accent/50' : 'border-border/70'
    }`}>
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold text-slate-800 break-words">{client.client_name || client.client_email}</p>
        <p className="flex items-center gap-1 text-[11px] text-slate-500 break-all">
          <Mail className="h-3 w-3 shrink-0" /> {client.client_email}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
          {client.shipping_mark && <span className="font-mono font-semibold text-blue-700">{client.shipping_mark}</span>}
          {client.state && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {[client.city, client.state].filter(Boolean).join(', ')}
            </span>
          )}
          {client.whatsapp && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {client.whatsapp}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{client.totals?.bultos || 0} bulto(s)</Badge>
        <Badge variant="secondary">{client.totals?.packages || 0} paquete(s)</Badge>
        <Badge variant="secondary">{Number(client.totals?.cbm || 0).toFixed(4)} CBM</Badge>
        {receipts.length > 0 && <Badge variant="secondary">{receipts.length} envío(s)</Badge>}
      </div>

      {groups.length === 0 ? (
        <p className="py-2 text-[11px] text-slate-500">Sin carga pendiente de facturar.</p>
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

      <Button
        size="sm"
        variant={selected ? 'secondary' : 'outline'}
        className="w-full"
        onClick={() => onSelect(client)}
      >
        <ChevronRight className="h-3.5 w-3.5 mr-1" />
        {selected ? 'Cliente cargado' : 'Facturar este cliente'}
      </Button>
    </div>
  );
}