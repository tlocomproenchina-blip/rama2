import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  ArrowUpCircle, ArrowDownCircle, Pencil, Trash2, MinusCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function ClientCreditRow({ credit, onUpdated }) {
  const [editOpen, setEditOpen] = useState(false);
  const [useOpen, setUseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editData, setEditData] = useState({
    amount: String(credit.amount ?? ''),
    description: credit.description || '',
    type: credit.type || 'credito',
    reference: credit.reference || ''
  });

  // Use form state (creates a negative movement)
  const [useData, setUseData] = useState({ amount: '', description: '', reference: '' });

  const isCredit = num(credit.amount) > 0;

  const handleEdit = async () => {
    const amount = num(editData.amount);
    if (amount === 0) {
      toast.error('El monto no puede ser 0');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.ClientCredit.update(credit.id, {
        amount,
        description: editData.description || '',
        type: editData.type || 'credito',
        reference: editData.reference || ''
      });
      base44.invalidateEntityCache('ClientCredit');
      toast.success('Movimiento actualizado');
      setEditOpen(false);
      onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error al actualizar');
    }
    setSaving(false);
  };

  const handleUse = async () => {
    const amount = num(useData.amount);
    if (amount <= 0) {
      toast.error('Ingresa un monto válido mayor a 0');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.ClientCredit.create({
        client_email: credit.client_email,
        amount: -amount,
        type: 'uso',
        description: useData.description || 'Uso manual de saldo',
        reference: useData.reference || '',
        created_by_email: credit.created_by_email || 'admin'
      });
      base44.invalidateEntityCache('ClientCredit');
      toast.success(`Saldo usado: $${amount.toFixed(2)}`);
      setUseOpen(false);
      setUseData({ amount: '', description: '', reference: '' });
      onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error al registrar uso');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await base44.entities.ClientCredit.delete(credit.id);
      base44.invalidateEntityCache('ClientCredit');
      toast.success('Movimiento eliminado');
      setDeleteOpen(false);
      onUpdated();
    } catch (err) {
      toast.error(err.message || 'Error al eliminar');
    }
    setSaving(false);
  };

  return (
    <>
      <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-white hover:bg-slate-50 transition-colors">
        <div className={`mt-0.5 p-2 rounded-lg ${isCredit ? 'bg-emerald-100' : 'bg-amber-100'}`}>
          {isCredit ? <ArrowUpCircle className="h-4 w-4 text-emerald-600" /> : <ArrowDownCircle className="h-4 w-4 text-amber-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${isCredit ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isCredit ? '+' : ''}${num(credit.amount).toFixed(2)}
            </span>
            <Badge variant="outline" className="text-xs capitalize">
              {credit.type === 'credito' ? 'Crédito' : credit.type === 'uso' ? 'Uso' : 'Ajuste'}
            </Badge>
            {credit.related_invoice_number && (
              <Badge variant="outline" className="text-xs">Factura: {credit.related_invoice_number}</Badge>
            )}
          </div>
          {credit.description && (
            <p className="text-sm text-slate-600 mt-0.5 break-words">{credit.description}</p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            {format(new Date(credit.created_date), 'dd/MM/yyyy HH:mm')}
            {credit.created_by_email && credit.created_by_email !== 'system' && ` · por ${credit.created_by_email}`}
            {credit.reference && ` · Ref: ${credit.reference}`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-blue-600"
            onClick={() => setEditOpen(true)}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-amber-600"
            onClick={() => setUseOpen(true)}
            title="Usar saldo"
          >
            <MinusCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-rose-600"
            onClick={() => setDeleteOpen(true)}
            title="Borrar"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar movimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-slate-600">Monto (USD) — usar negativo para uso</Label>
              <Input
                type="number"
                step="0.01"
                value={editData.amount}
                onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Tipo</Label>
              <Select
                value={editData.type}
                onValueChange={(val) => setEditData({ ...editData, type: val })}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="uso">Uso</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-600">Descripción</Label>
              <Textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Referencia</Label>
              <Input
                value={editData.reference}
                onChange={(e) => setEditData({ ...editData, reference: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Use dialog */}
      <Dialog open={useOpen} onOpenChange={setUseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usar saldo a favor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-slate-600">Monto a usar (USD)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={useData.amount}
                onChange={(e) => setUseData({ ...useData, amount: e.target.value })}
                placeholder="50.00"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Descripción / Motivo</Label>
              <Textarea
                value={useData.description}
                onChange={(e) => setUseData({ ...useData, description: e.target.value })}
                placeholder="Ej: Pago de servicio, compensación..."
                rows={2}
              />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Referencia (opcional)</Label>
              <Input
                value={useData.reference}
                onChange={(e) => setUseData({ ...useData, reference: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleUse} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <MinusCircle className="h-4 w-4 mr-1" /> Usar saldo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar movimiento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            ¿Seguro que deseas eliminar este movimiento de{' '}
            <span className={isCredit ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
              {isCredit ? '+' : ''}${num(credit.amount).toFixed(2)}
            </span>
            ? Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleDelete} disabled={saving} variant="destructive">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}