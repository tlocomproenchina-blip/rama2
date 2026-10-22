import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, User, Boxes, DoorOpen, X, Hash } from 'lucide-react';
import UniversalClientSearch from '@/components/warehouse/UniversalClientSearch';
import { base44 } from '@/components/api/ApiQueueManager';
import { getAll as idbGetAll } from '@/lib/offlineDb';
import { isCajaCode } from '@/lib/cajaCodes';

const DISPATCHABLE = ['activo', 'cerrado', 'en_almacen_ve'];
const STATUS_LABEL = { activo: 'Abierto', cerrado: 'Cerrado', en_almacen_ve: 'En almacén VE' };
// Estados de paquete que siguen dentro del almacén (no han salido).
const IN_WAREHOUSE_PKG = ['pre_alerta', 'recibido', 'consolidado', 'en_transito', 'disponible', 'sin_cliente'];

const norm = (v) => String(v || '').toLowerCase();
const isDispatchable = (b) => DISPATCHABLE.includes(b.status || 'activo') || (b.pending_packages || 0) > 0;

// Bultos del cliente tal como están en el servidor (misma fuente que el historial).
// Incluye los que figuran como 'despachado' pero todavía tienen paquetes en el almacén:
// esos se pueden despachar de verdad (al darles salida se reactivan primero).
async function loadServerBultos(email) {
  const res = await base44.entities.Bulto.filter(
    { client_email: email }, 'bulto_number', 300
  ).catch(() => []);
  const list = (res?.items || res || []).filter(Boolean);

  const dispatched = list.filter((b) => b.status === 'despachado' && (b.package_ids || []).length);
  if (!dispatched.length) return list;

  const ids = dispatched.flatMap((b) => b.package_ids || []);
  const pkgsRes = await base44.entities.Package.filter(
    { id: { $in: ids } }, '-created_date', 500
  ).catch(() => []);
  const packages = pkgsRes?.items || pkgsRes || [];
  const inside = new Set(
    packages.filter((p) => IN_WAREHOUSE_PKG.includes(p.status || '')).map((p) => p.id)
  );

  return list
    .filter((b) => isDispatchable(b) || (b.package_ids || []).some((id) => inside.has(id)))
    .map((b) => {
      const pending = (b.package_ids || []).filter((id) => inside.has(id)).length;
      return pending ? { ...b, pending_packages: pending } : b;
    });
}

// Despacho manual sin escáner: se busca y selecciona el cliente, se elige su bulto o caja
// y se despacha con el mismo proceso del escaneo (paquetes despachados + guía + aviso).
export default function ManualBultoDispatchCard({ onDispatch }) {
  const [client, setClient] = useState(null);
  const [bultos, setBultos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState('');
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!client?.email) {
      setBultos([]);
      setSelected('');
      return undefined;
    }
    setLoading(true);
    (async () => {
      const [serverList, localList] = await Promise.all([
        loadServerBultos(client.email),
        idbGetAll('bultos').then((list) => list || []).catch(() => []),
      ]);
      if (!alive) return;
      const email = norm(client.email);
      const seen = new Set();
      const merged = [];
      for (const b of [...serverList, ...localList]) {
        if (norm(b.client_email) !== email) continue;
        if (!isDispatchable(b)) continue;
        const key = b.label_code || b.id;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(b);
      }
      merged.sort((a, b) => (a.bulto_number || 0) - (b.bulto_number || 0));
      setBultos(merged);
      setSelected(merged.length === 1 ? merged[0].label_code : '');
      setLoading(false);
    })().catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [client]);

  const current = bultos.find((b) => b.label_code === selected) || null;

  const handleDispatch = async () => {
    if (!current) return;
    setDispatching(true);
    try {
      await onDispatch(current);
      setBultos((prev) => prev.filter((b) => b.label_code !== current.label_code));
      setSelected('');
    } finally {
      setDispatching(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-blue-600" />
          <p className="text-sm font-semibold text-slate-800">Despacho manual sin escanear</p>
        </div>
        <p className="text-xs text-slate-500">
          Busca al cliente, elige su bulto o caja y dale salida de almacén. Es el mismo despacho del
          escáner: los paquetes salen y el cliente recibe la notificación.
        </p>

        {client ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <User className="h-4 w-4 shrink-0 text-blue-600" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{client.full_name || client.email}</p>
                <p className="truncate text-xs text-slate-500">
                  {[client.shipping_mark, client.email].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setClient(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <UniversalClientSearch onSelect={setClient} />
        )}

        {client && (loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando bultos…
          </div>
        ) : bultos.length === 0 ? (
          <p className="text-sm text-slate-500">
            Este cliente no tiene bultos pendientes de despacho en el almacén.
          </p>
        ) : (
          <div className="max-h-56 min-w-0 space-y-1.5 overflow-y-auto overflow-x-hidden rounded-lg border border-border p-2">
            {bultos.map((b) => {
              const isSelected = selected === b.label_code;
              const count = (b.package_ids || []).length || (b.package_trackings || []).length;
              const containers = (Array.isArray(b.cbm_order_numbers) ? b.cbm_order_numbers : [])
                .map((value) => String(value || '').trim())
                .filter(Boolean);
              return (
                <button
                  key={b.label_code}
                  type="button"
                  onClick={() => setSelected(b.label_code)}
                  className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                    isSelected ? 'border-blue-400 bg-blue-50' : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <span className={`h-3.5 w-3.5 shrink-0 rounded-full border ${
                    isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-semibold text-slate-800">{b.label_code}</p>
                    <p className="text-[10px] text-slate-500">
                      {isCajaCode(b.label_code) ? 'Caja consolidada' : 'Bulto'} · {count} paquete(s)
                      {STATUS_LABEL[b.status] ? ` · ${STATUS_LABEL[b.status]}` : ''}
                    </p>
                    <p className={`flex items-center gap-1 text-[10px] ${
                      containers.length ? 'text-slate-600' : 'text-amber-700'
                    }`}>
                      <Hash className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {containers.length ? `Contenedor ${containers.join(', ')}` : 'Sin contenedor asignado'}
                      </span>
                    </p>
                    {b.pending_packages > 0 && (
                      <p className="text-[10px] font-medium text-amber-700">
                        Figuró despachado, pero tiene {b.pending_packages} paquete(s) en el almacén
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}

        {current && (
          <Button onClick={handleDispatch} disabled={dispatching} className="w-full bg-blue-600 hover:bg-blue-700">
            {dispatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DoorOpen className="mr-2 h-4 w-4" />}
            Dar salida a {current.label_code}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}