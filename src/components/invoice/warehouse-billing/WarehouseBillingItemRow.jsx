import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, Truck, AlertTriangle, Pencil, Loader2 } from 'lucide-react';

const money = (v) => `$${Number(v || 0).toFixed(2)}`;

const toNumber = (raw) => {
  const clean = String(raw ?? '').replace(',', '.').trim();
  if (!clean) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
};

export default function WarehouseBillingItemRow({ item, amount, checked, onToggle, onSave }) {
  const [editing, setEditing] = useState(false);
  const [cbm, setCbm] = useState('');
  const [count, setCount] = useState('');
  const [saving, setSaving] = useState(false);

  const editable = item.type === 'bulto' && typeof onSave === 'function';
  const hasCbm = Number(item.cbm || 0) > 0;

  const openEditor = () => {
    setCbm(hasCbm ? String(item.cbm) : '');
    setCount(String(item.package_count || 1));
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const ok = await onSave(item, { cbm: toNumber(cbm), package_count: toNumber(count) });
    if (ok) setEditing(false);
    setSaving(false);
  };

  return (
    <div
      onClick={() => { if (!editing) onToggle?.(); }}
      className={`rounded-xl border p-3 transition-colors ${
        checked ? 'border-primary/50 bg-accent/60' : 'border-border/70 hover:border-border'
      } ${editing ? '' : 'cursor-pointer'}`}
    >
      <div className="flex items-start gap-3">
        <span onClick={(e) => e.stopPropagation()} className="mt-1">
          <Checkbox checked={checked} onCheckedChange={onToggle} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 break-all">
              {item.type === 'bulto' ? `Bulto ${item.label}` : `Envío ${item.label}`}
            </span>
            <span className="font-semibold text-primary shrink-0">{money(amount)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              {item.type === 'bulto' ? <Package className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
              {Number(item.cbm || 0).toFixed(4)} CBM
            </span>
            <span className="text-slate-400">·</span>
            <span>{item.package_count || 0} paquete(s)</span>
            {item.order_numbers?.length > 0 && (
              <>
                <span className="text-slate-400">·</span>
                <span className="font-mono">Orden {item.order_numbers.join(', ')}</span>
              </>
            )}
            {item.fecha && (
              <>
                <span className="text-slate-400">·</span>
                <span>{new Date(item.fecha).toLocaleDateString('es-VE')}</span>
              </>
            )}
          </div>

          {(item.type === 'bulto' && !item.order_numbers?.length) && (
            <Badge className="mt-2 mr-1 bg-amber-100 text-amber-700 border border-amber-200">Sin N° de orden</Badge>
          )}
          {Number(item.cbm || 0) <= 0 && (
            <Badge className="mt-2 mr-1 bg-slate-100 text-slate-600 border border-slate-200">Sin CBM registrado</Badge>
          )}
          {item.overlap_bulto && (
            <Badge className="mt-2 bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Ya incluido en un bulto en almacén
            </Badge>
          )}

          {item.trackings?.length > 0 && (
            <p className="mt-2 text-xs text-slate-500 break-all line-clamp-2">{item.trackings.join(', ')}</p>
          )}

          {editable && !editing && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={(e) => { e.stopPropagation(); openEditor(); }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              {hasCbm ? 'Editar CBM y paquetes' : 'Registrar CBM'}
            </Button>
          )}

          {editing && (
            <div className="mt-3 rounded-lg border border-border/70 bg-card p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">CBM del bulto</span>
                  <Input
                    value={cbm}
                    onChange={(e) => setCbm(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.0000"
                    className="mt-1 h-10"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">Cantidad de paquetes</span>
                  <Input
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    inputMode="numeric"
                    placeholder="1"
                    className="mt-1 h-10"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                  Cancelar
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">
                El CBM queda como CBM del bulto y como volumen real de sus paquetes. La cantidad corrige el conteo de paquetes del bulto.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}