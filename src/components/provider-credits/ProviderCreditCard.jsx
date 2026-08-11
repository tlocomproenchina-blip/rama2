import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, ImageIcon, CheckCircle2, Eye, Pencil, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import ProviderCreditForm from '@/components/provider-credits/ProviderCreditForm';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function ProviderCreditCard({ credit, onMarkUsed, onViewFile, onEdit, savingEdit }) {
  const [showUseDialog, setShowUseDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [useAmount, setUseAmount] = useState('');
  const [useDescription, setUseDescription] = useState('');

  const isUsed = credit.status === 'usado';
  const remaining = isUsed ? num(credit.credit_amount) - num(credit.used_amount) : num(credit.credit_amount);

  const handleConfirmUse = () => {
    const amount = num(useAmount);
    if (amount <= 0 || amount > num(credit.credit_amount)) {
      alert('Ingresa un monto válido (mayor a 0 y menor o igual al saldo a favor)');
      return;
    }
    onMarkUsed(credit, amount, useDescription.trim());
    setShowUseDialog(false);
    setUseAmount('');
    setUseDescription('');
  };

  return (
    <>
      <div className={`rounded-xl border p-4 transition-colors ${isUsed ? 'border-slate-200 bg-slate-50/50' : 'border-emerald-200 bg-white hover:bg-emerald-50/30'}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-slate-800 truncate">{credit.provider_name}</h4>
              <Badge variant={isUsed ? 'secondary' : 'default'} className={isUsed ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}>
                {isUsed ? 'Usado' : 'Disponible'}
              </Badge>
            </div>
            {credit.invoice_number && (
              <p className="text-xs text-slate-500 mt-0.5">Factura: {credit.invoice_number}</p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">
              {credit.payment_date ? format(new Date(credit.payment_date), 'dd/MM/yyyy') : '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Saldo a favor</p>
            <p className={`text-lg font-bold ${isUsed ? 'text-slate-500' : 'text-emerald-700'}`}>
              ${num(credit.credit_amount).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Desglose de montos */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-100 p-2">
            <span className="text-slate-500">Factura:</span>{' '}
            <span className="font-medium text-slate-700">${num(credit.invoice_amount).toFixed(2)}</span>
          </div>
          <div className="rounded-lg bg-slate-100 p-2">
            <span className="text-slate-500">Pagado:</span>{' '}
            <span className="font-medium text-slate-700">${num(credit.paid_amount).toFixed(2)}</span>
          </div>
        </div>

        {/* Imágenes */}
        {(credit.invoice_image_url || credit.receipt_image_url) && (
          <div className="mt-3 flex gap-2">
            {credit.invoice_image_url && (
              <button
                onClick={() => onViewFile(credit.invoice_image_url, 'Factura')}
                className="flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                <FileText className="h-3 w-3" /> Ver factura
              </button>
            )}
            {credit.receipt_image_url && (
              <button
                onClick={() => onViewFile(credit.receipt_image_url, 'Comprobante')}
                className="flex items-center gap-1 rounded-lg border border-border bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                <ImageIcon className="h-3 w-3" /> Ver comprobante
              </button>
            )}
          </div>
        )}

        {/* Info de uso */}
        {isUsed && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs">
            <p className="text-amber-700">
              Usado: <span className="font-semibold">${num(credit.used_amount).toFixed(2)}</span>
              {remaining > 0 && <> · Restante: ${remaining.toFixed(2)}</>}
            </p>
            {credit.used_description && (
              <p className="text-amber-600 mt-0.5">{credit.used_description}</p>
            )}
            {credit.used_date && (
              <p className="text-amber-500 mt-0.5">{format(new Date(credit.used_date), 'dd/MM/yyyy')}</p>
            )}
          </div>
        )}

        {credit.notes && (
          <p className="mt-2 text-xs text-slate-500 italic">{credit.notes}</p>
        )}

        {/* Acción */}
        <div className="mt-3 pt-3 border-t border-border/50 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowEditDialog(true)}
            className="text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4 mr-1" /> Editar
          </Button>
          {!isUsed && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowUseDialog(true)}
              className="flex-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar como usado
            </Button>
          )}
        </div>
      </div>

      {/* Dialog para editar */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar saldo a favor</DialogTitle>
          </DialogHeader>
          <ProviderCreditForm
            initialData={credit}
            saving={savingEdit}
            onCancel={() => setShowEditDialog(false)}
            onSave={(data) => {
              onEdit(credit, data);
              setShowEditDialog(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog para marcar como usado */}
      <Dialog open={showUseDialog} onOpenChange={setShowUseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar saldo a favor como usado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-emerald-50 p-3 text-sm">
              <p className="text-emerald-700">Saldo disponible: <span className="font-bold">${num(credit.credit_amount).toFixed(2)}</span></p>
              <p className="text-slate-600 text-xs mt-0.5">Proveedor: {credit.provider_name}</p>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Monto a usar (USD)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={num(credit.credit_amount)}
                value={useAmount}
                onChange={(e) => setUseAmount(e.target.value)}
                placeholder={num(credit.credit_amount).toFixed(2)}
              />
              <p className="text-xs text-slate-400 mt-1">Deja el monto total para marcar todo como usado.</p>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Descripción del uso (opcional)</Label>
              <Input
                value={useDescription}
                onChange={(e) => setUseDescription(e.target.value)}
                placeholder="Ej: Aplicado a factura FAC-2026-002"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUseDialog(false)}>Cancelar</Button>
            <Button onClick={handleConfirmUse} className="bg-emerald-600 hover:bg-emerald-700">
              Confirmar uso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}