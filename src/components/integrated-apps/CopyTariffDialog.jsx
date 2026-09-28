import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, DollarSign } from 'lucide-react';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Tarifa propia de una copia: es la que se aplica a los bultos y recibos que
// llegan de ella, en lugar de la tarifa normal de TLEC CARGO.
export default function CopyTariffDialog({ open, app, saving, onClose, onSave }) {
  const [rateRegular, setRateRegular] = useState('');
  const [rateHigh, setRateHigh] = useState('');
  const [prefix, setPrefix] = useState('');
  const [ranges, setRanges] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setRateRegular(app?.rate_cbm_regular ? String(app.rate_cbm_regular) : '');
    setRateHigh(app?.rate_cbm_high_risk ? String(app.rate_cbm_high_risk) : '');
    setPrefix(app?.shipping_mark_prefix || '');
    setRanges(Array.isArray(app?.special_cbm_rates) ? app.special_cbm_rates : []);
    setError('');
  }, [open, app]);

  const updateRange = (index, field, value) => {
    setRanges((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };
  const addRange = () => setRanges((prev) => [...prev, { min_cbm: '', max_cbm: '', rate_regular: '', rate_high_risk: '' }]);
  const removeRange = (index) => setRanges((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = () => {
    const regular = Number(String(rateRegular).replace(',', '.'));
    const high = Number(String(rateHigh).replace(',', '.'));
    if (!Number.isFinite(regular) || regular < 0 || !Number.isFinite(high) || high < 0) {
      setError('Escribe las tarifas por CBM como números iguales o mayores a 0');
      return;
    }
    if (regular <= 0 && high <= 0 && ranges.length === 0) {
      setError('Registra al menos la tarifa general por CBM de esta copia');
      return;
    }
    setError('');
    onSave({
      rate_cbm_regular: regular,
      rate_cbm_high_risk: high,
      shipping_mark_prefix: prefix.trim(),
      special_cbm_rates: ranges.map((row) => ({
        min_cbm: num(row.min_cbm),
        max_cbm: num(row.max_cbm),
        rate_regular: num(row.rate_regular),
        rate_high_risk: num(row.rate_high_risk),
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" /> Tarifa de {app?.name || 'la copia'}
          </DialogTitle>
          <DialogDescription>
            Los bultos y recibos que llegan de esta copia se facturan con esta tarifa, no con la tarifa normal
            de TLEC CARGO. El recargo de estado y el puerta a puerta no se aplican a la carga de una copia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="copy-rate-regular">Tarifa general ($/CBM)</Label>
              <Input
                id="copy-rate-regular"
                inputMode="decimal"
                value={rateRegular}
                onChange={(e) => setRateRegular(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="copy-rate-high">Tarifa alto riesgo ($/CBM)</Label>
              <Input
                id="copy-rate-high"
                inputMode="decimal"
                value={rateHigh}
                onChange={(e) => setRateHigh(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="copy-prefix">Prefijo de shipping mark de la copia</Label>
            <Input
              id="copy-prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Ej: VALC-"
            />
            <p className="text-[11px] text-slate-500">
              Solo para identificarla en el panel: sus clientes ya se reconocen por el shipping mark que envía la copia.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Tarifas por volumen menor a 0.130 CBM (opcional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRange} className="gap-1 shrink-0">
                <Plus className="h-3.5 w-3.5" /> Agregar rango
              </Button>
            </div>
            {ranges.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                Sin rangos especiales: las cargas pequeñas de esta copia usan su tarifa por CBM.
              </p>
            ) : (
              <div className="space-y-3">
                {ranges.map((row, index) => (
                  <div key={index} className="rounded-xl border border-border/70 bg-card p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[11px] text-slate-500 mb-1">CBM mínimo</p>
                        <Input
                          inputMode="decimal"
                          value={row.min_cbm ?? ''}
                          onChange={(e) => updateRange(index, 'min_cbm', e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 mb-1">CBM máximo</p>
                        <Input
                          inputMode="decimal"
                          value={row.max_cbm ?? ''}
                          onChange={(e) => updateRange(index, 'max_cbm', e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 mb-1">Monto regular ($)</p>
                        <Input
                          inputMode="decimal"
                          value={row.rate_regular ?? ''}
                          onChange={(e) => updateRange(index, 'rate_regular', e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 mb-1">Monto alto riesgo ($)</p>
                        <Input
                          inputMode="decimal"
                          value={row.rate_high_risk ?? ''}
                          onChange={(e) => updateRange(index, 'rate_high_risk', e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRange(index)}
                      className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar rango
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando…</> : 'Guardar tarifa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}