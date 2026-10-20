import React, { useCallback, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

const money = (value) => `$${(Number(value) || 0).toFixed(2)}`;

// Una factura dentro del panel de cargos: qué se cobraría hoy y, al abrirla, las
// unidades que siguen en almacén (para marcarlas) y el desglose día por día.
export default function StorageChargeInvoiceRow({ row, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingMarks, setSavingMarks] = useState(false);

  const units = draft.length ? draft : (row.units || []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await base44.entities.StorageCharge.filter(
        { invoice_id: row.invoice_id },
        { sort: '-day_number', limit: 100 }
      );
      setHistory(Array.isArray(res) ? res : res?.items || []);
    } catch {
      setHistory([]);
    }
    setLoadingHistory(false);
  }, [row.invoice_id]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setDraft((row.units || []).map((u) => ({ ...u })));
      if (!history) loadHistory();
    }
  };

  const setUnit = (index, field, value) => {
    setDraft((prev) => {
      const base = prev.length ? [...prev] : (row.units || []).map((u) => ({ ...u }));
      base[index] = { ...base[index], [field]: value };
      return base;
    });
  };

  const saveMarks = async () => {
    const targets = units.filter((u) => u.bulto_id);
    if (!targets.length) {
      toast.info('Esta factura no tiene bultos registrados: se cobra por envío facturado.');
      return;
    }
    setSavingMarks(true);
    try {
      await Promise.all(targets.map((u) => base44.entities.Bulto.update(u.bulto_id, {
        storage_category: u.category,
        pallet_count: Number(u.pallets) || 0,
        requiere_montacargas: !!u.requires_forklift,
      })));
      toast.success('Marcado de bultos guardado');
      await onRefresh?.();
    } catch {
      toast.error('No se pudo guardar el marcado de los bultos');
    }
    setSavingMarks(false);
  };

  const accumulated = (history || []).reduce((sum, h) => sum + (Number(h.amount) || 0), 0);

  return (
    <div className={`rounded-xl border ${row.changed ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-card'}`}>
      <button type="button" onClick={toggle} className="flex w-full flex-wrap items-center gap-2 p-3 text-left">
        <div className="min-w-[190px] flex-1">
          <p className="text-sm font-semibold text-slate-800">{row.invoice_number || row.invoice_id}</p>
          <p className="text-[11px] text-slate-500">{row.client_email}</p>
        </div>
        <Badge variant="outline" className="text-[11px]">Día {row.day_number}</Badge>
        <span className="text-[11px] text-slate-600">
          {row.units_standard} estándar · {row.units_large} grande
          {row.forklift_pallets ? ` · ${row.forklift_pallets} palet(s) montacargas` : ''}
        </span>
        {row.units_source === 'envio' && <Badge variant="secondary" className="text-[11px]">por envío</Badge>}
        {row.stopped && <Badge className="bg-slate-700 text-[11px]">cargos detenidos (día {row.day_number})</Badge>}
        <span className={`ml-auto text-sm font-bold ${row.changed ? 'text-amber-700' : 'text-emerald-700'}`}>
          {row.changed ? `+${money(row.amount)}` : 'sin cargos nuevos'}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-200 p-3">
          {row.reason && <p className="text-[11px] text-amber-700">{row.reason}</p>}
          {row.days?.length > 0 && (
            <p className="text-[11px] text-slate-500">
              Días a cobrar ahora: {row.days.join(', ')} · {money(row.daily_amount)} diarios · almacenamiento {money(row.storage_amount)}
              {row.forklift_amount > 0 ? ` · montacargas ${money(row.forklift_amount)}` : ''} · total {money(row.amount)}
            </p>
          )}

          {units.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unidades en almacén</p>
              <div className="space-y-1.5">
                {units.map((unit, index) => (
                  <div key={unit.bulto_id || unit.label_code || index} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                    <span className="min-w-[160px] flex-1 truncate text-[12px] font-medium text-slate-700">
                      {unit.label_code}
                      {unit.volume_cbm > 0 && <span className="ml-1 font-normal text-slate-400">· {unit.volume_cbm} CBM</span>}
                    </span>
                    <Select value={unit.category} onValueChange={(value) => setUnit(index, 'category', value)}>
                      <SelectTrigger className="h-8 w-[130px] text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="estandar">Estándar $10</SelectItem>
                        <SelectItem value="grande">Grande $20</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      value={unit.pallets || 0}
                      onChange={(e) => setUnit(index, 'pallets', Number(e.target.value) || 0)}
                      className="h-8 w-[70px] text-[11px]"
                      title="Palets de este bulto"
                    />
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Checkbox
                        checked={!!unit.requires_forklift}
                        onCheckedChange={(value) => setUnit(index, 'requires_forklift', !!value)}
                      />
                      Montacargas
                    </label>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={saveMarks} disabled={savingMarks}>
                {savingMarks ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                Guardar marcado
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Desglose registrado</p>
            {loadingHistory ? (
              <div className="flex items-center gap-2 py-2 text-[11px] text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando…
              </div>
            ) : (history || []).length === 0 ? (
              <p className="text-[11px] text-slate-500">Todavía no hay cargos registrados para esta factura.</p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                    <span className="font-medium text-slate-700">{h.charge_date}</span>
                    <span>{h.days_count ? `día ${h.day_number} (${h.days_count} día/s)` : `día ${h.day_number}`}</span>
                    <span>{h.units_standard} est. · {h.units_large} grande</span>
                    {Number(h.forklift_amount) > 0 && <span className="text-slate-700">montacargas {money(h.forklift_amount)}</span>}
                    <span className="ml-auto font-semibold text-slate-800">{money(h.amount)}</span>
                    <span className="text-slate-500">acum. {money(h.accumulated_amount)}</span>
                  </div>
                ))}
                <p className="pt-1 text-[11px] font-semibold text-slate-700">Acumulado registrado: {money(accumulated)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}