import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Truck, Pencil, Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const money = (v) => `$${Number(v || 0).toFixed(2)}`;

const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-VE');
};

const toNumber = (raw) => {
  const clean = String(raw ?? '').replace(',', '.').trim();
  if (!clean) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
};

export default function WarehouseBillingItemRow({ item, amount, checked, onToggle, onSave, stateLabel, rateLabel }) {
  const [editing, setEditing] = useState(false);
  const [cbm, setCbm] = useState('');
  const [count, setCount] = useState('');
  const [risk, setRisk] = useState('general');
  const [saving, setSaving] = useState(false);

  const editable = item.type === 'bulto' && typeof onSave === 'function';
  const hasCbm = Number(item.cbm || 0) > 0;
  const hasTariff = item.type === 'bulto' && !!item.has_registered_tariff;
  // Con tarifa registrada, la fila muestra el monto aunque el bulto no esté marcado.
  const shown = checked || !hasTariff ? amount : item.registered_amount;

  const openEditor = () => {
    setCbm(hasCbm ? String(item.cbm) : '');
    setCount(String(item.package_count || 1));
    setRisk(item.risk_category || 'general');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const ok = await onSave(item, {
      cbm: toNumber(cbm),
      package_count: toNumber(count),
      risk_category: risk,
    });
    if (ok) setEditing(false);
    setSaving(false);
  };

  // Vuelve a calcular la tarifa del bulto con las tarifas vigentes y la guarda
  const recalculate = async () => {
    const value = toNumber(cbm) ?? (hasCbm ? Number(item.cbm) : null);
    if (value == null || value <= 0) {
      toast.error('Registra el CBM del bulto para calcular su tarifa');
      return;
    }
    setSaving(true);
    const ok = await onSave(item, {
      cbm: value,
      package_count: toNumber(count),
      risk_category: risk,
      recalculate_tariff: true,
    });
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
            <span className="font-semibold text-primary shrink-0">{money(shown)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              {item.type === 'bulto' ? <Package className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
              {Number(item.cbm || 0).toFixed(4)} CBM
            </span>
            <span className="text-slate-400">·</span>
            <span>{item.package_count || 0} paquete(s)</span>
            <span className="text-slate-400">·</span>
            {Number(item.insurance || 0) > 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                <ShieldCheck className="h-3 w-3" /> Seguro incluido {money(item.insurance)}
              </span>
            ) : (
              <span className="text-slate-400">Sin seguro registrado</span>
            )}
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

          {item.type === 'bulto' && item.ve_date_source === 'escaneo' && (
            <p className="mt-1.5 text-xs text-emerald-700">
              Reconocido en almacén VE: {formatDate(item.ve_recognized_date)}
              {item.ve_recognized_by ? ` · por ${item.ve_recognized_by}` : ''}
            </p>
          )}
          {item.type === 'bulto' && item.ve_date_source === 'registro' && (
            <p className="mt-1.5 text-xs text-slate-500">
              En almacén desde: {formatDate(item.ve_registered_date)} · fecha de registro (sin escaneo)
            </p>
          )}
          {item.type === 'bulto' && !item.ve_date_source && (
            <Badge className="mt-2 mr-1 bg-amber-100 text-amber-700 border border-amber-200">Sin fecha de escaneo</Badge>
          )}

          {item.type === 'receipt' && (
            item.in_bulto ? (
              <p className="mt-1.5 text-xs text-slate-600">
                En bulto <span className="font-mono">{item.in_bulto}</span> · {item.ve_date_source === 'registro' ? 'en almacén desde' : 'reconocido el'} {formatDate(item.ve_date)}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">Sin bulto asignado</p>
            )
          )}

          {hasTariff && (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-slate-600">
                Tarifa registrada {money(item.registered_amount)} ·{' '}
                {item.risk_category === 'alto_riesgo' ? 'alto riesgo' : 'carga general'} ·{' '}
                {item.registered_rate_kind === 'especial'
                  ? 'tarifa especial por volumen'
                  : `${money(item.registered_rate_per_cbm)}/CBM`}
              </p>
              {stateLabel ? (
                <p className="text-xs text-slate-500">Estado del cliente usado: {stateLabel}</p>
              ) : (
                <p className="text-xs text-amber-600">
                  El cliente no tiene estado registrado: la tarifa se calculó sin recargo de estado.
                </p>
              )}
            </div>
          )}

          {hasTariff && rateLabel === 'anterior' && (
            <Badge className="mt-2 mr-1 bg-sky-100 text-sky-700 border border-sky-200">Tarifa anterior</Badge>
          )}
          {(item.type === 'bulto' && !item.order_numbers?.length) && (
            <Badge className="mt-2 mr-1 bg-amber-100 text-amber-700 border border-amber-200">Sin N° de orden</Badge>
          )}
          {Number(item.cbm || 0) <= 0 && (
            <Badge className="mt-2 mr-1 bg-slate-100 text-slate-600 border border-slate-200">Sin CBM registrado</Badge>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">Tipo de carga</span>
                  <Select value={risk} onValueChange={setRisk}>
                    <SelectTrigger className="mt-1 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Carga general</SelectItem>
                      <SelectItem value="alto_riesgo">Alto riesgo</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
                {item.has_registered_tariff && (
                  <Button size="sm" variant="outline" onClick={recalculate} disabled={saving}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Recalcular tarifa
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                  Cancelar
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">
                El CBM queda como CBM del bulto y como volumen real de sus paquetes. Al guardar se registra la tarifa
                del bulto con el estado del cliente, su volumen y su tipo de carga, y la factura usa ese monto.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}