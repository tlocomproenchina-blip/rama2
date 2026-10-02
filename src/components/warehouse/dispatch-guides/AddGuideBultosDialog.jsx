import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';

// Suma a la guía las cajas y bultos del cliente que todavía no están en ninguna guía:
// se marcan los que entran y la guía se recalcula sola.
export default function AddGuideBultosDialog({ guide, clientGroup, open, onOpenChange, onSaved }) {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const email = clientGroup?.client_email || '';

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    if (!email) {
      setUnits([]);
      return;
    }
    setLoading(true);
    base44.functions
      .invoke('listDispatchLabelUnits', { client_email: email })
      .then((res) => {
        const data = res?.data || res || {};
        setUnits((Array.isArray(data.units) ? data.units : []).filter((unit) => !unit.in_guide));
      })
      .catch(() => {
        setUnits([]);
        toast.error('No se pudieron cargar las cajas del cliente');
      })
      .finally(() => setLoading(false));
  }, [open, email]);

  const toggle = (code) => {
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const save = async () => {
    if (!selected.length) return;
    setSaving(true);
    try {
      await base44.functions.invoke('updateDispatchGuideBultos', {
        guide_id: guide.id,
        client_email: email,
        add_codes: selected,
      });
      toast.success(`${selected.length} bulto(s) sumados a la guía ${guide.guide_number}`);
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'No se pudieron agregar los bultos');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar bultos a la guía {guide?.guide_number || ''}</DialogTitle>
          <DialogDescription>
            Cajas y bultos de {clientGroup?.client_name || email || 'este cliente'} que todavía no están en
            una guía. Marca los que van a entrar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : !email ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
            Este cliente no tiene email registrado en la guía, así que no se pueden buscar sus bultos.
          </p>
        ) : units.length === 0 ? (
          <p className="rounded-xl border border-border/70 p-3 text-xs text-slate-500">
            No hay cajas ni bultos pendientes de este cliente: todos están en alguna guía.
          </p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {units.map((unit) => (
              <label
                key={unit.label_code}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/70 p-2.5"
              >
                <Checkbox
                  checked={selected.includes(unit.label_code)}
                  onCheckedChange={() => toggle(unit.label_code)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-xs text-foreground break-all">{unit.label_code}</span>
                  <span className="block text-[11px] text-slate-500">
                    {unit.is_caja ? 'Caja consolidada' : 'Bulto'} · {unit.package_count || 0} paquete(s)
                    {unit.cbm > 0 ? ` · ${Number(unit.cbm).toFixed(3)} CBM` : ''}
                    {unit.order_numbers?.length ? ` · Orden ${unit.order_numbers.join(', ')}` : ''}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button onClick={save} disabled={saving || selected.length === 0}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Agregar {selected.length || ''} bulto(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}