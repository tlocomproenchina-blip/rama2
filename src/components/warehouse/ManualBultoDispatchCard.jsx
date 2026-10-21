import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, User, Boxes, DoorOpen, X } from 'lucide-react';
import UniversalClientSearch from '@/components/warehouse/UniversalClientSearch';
import { getAll as idbGetAll } from '@/lib/offlineDb';
import { isCajaCode } from '@/lib/cajaCodes';

const DISPATCHABLE = ['activo', 'cerrado', 'en_almacen_ve'];
const STATUS_LABEL = { activo: 'Abierto', cerrado: 'Cerrado', en_almacen_ve: 'En almacén VE' };

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
      const all = await idbGetAll('bultos');
      const mine = (all || [])
        .filter((b) => String(b.client_email || '').toLowerCase() === client.email.toLowerCase())
        .filter((b) => DISPATCHABLE.includes(b.status || 'activo'))
        .sort((a, b) => (a.bulto_number || 0) - (b.bulto_number || 0));
      if (!alive) return;
      setBultos(mine);
      setSelected(mine.length === 1 ? mine[0].label_code : '');
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