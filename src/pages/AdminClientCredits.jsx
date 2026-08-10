import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Wallet, Search, Plus, Loader2, ArrowUpCircle, ArrowDownCircle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import PageHero from '@/components/common/PageHero';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function AdminClientCredits() {
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [credits, setCredits] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCredit, setNewCredit] = useState({ amount: '', description: '', type: 'credito', reference: '' });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (email) => {
    setLoading(true);
    try {
      const records = await base44.entities.ClientCredit.filter({ client_email: email }, '-created_date');
      const bal = records.reduce((sum, c) => sum + num(c.amount), 0);
      setCredits(records);
      setBalance(bal);
    } catch {
      toast.error('Error al cargar los saldos');
      setCredits([]);
      setBalance(0);
    }
    setLoading(false);
  }, []);

  const handleSearch = () => {
    const email = searchEmail.trim().toLowerCase();
    if (!email) {
      toast.error('Ingresa un email de cliente');
      return;
    }
    setSelectedEmail(email);
    loadData(email);
  };

  const handleAddCredit = async () => {
    const amount = num(newCredit.amount);
    if (!selectedEmail || amount <= 0) {
      toast.error('Ingresa un monto válido mayor a 0');
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('addClientCredit', {
        client_email: selectedEmail,
        amount,
        description: newCredit.description || 'Crédito manual',
        type: newCredit.type || 'credito',
        reference: newCredit.reference || ''
      });
      if (res?.data?.success) {
        const applied = res.data.applied || [];
        if (applied.length > 0) {
          const msg = applied.map(a => `Factura ${a.invoice_number}: -$${num(a.applied).toFixed(2)}${a.fully_paid ? ' (pagada)' : ''}`).join(', ');
          toast.success(`Crédito añadido y aplicado automáticamente. ${msg}`, { duration: 8000 });
        } else {
          toast.success(`Crédido de $${amount.toFixed(2)} añadido. Saldo disponible: $${num(res.data.remaining_balance).toFixed(2)}`);
        }
        setNewCredit({ amount: '', description: '', type: 'credito', reference: '' });
        setShowAddForm(false);
        loadData(selectedEmail);
      } else {
        toast.error(res?.data?.error || 'Error al añadir crédito');
      }
    } catch (err) {
      toast.error(err.message || 'Error al añadir crédito');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHero
        icon={Wallet}
        title="Saldos a Favor de Clientes"
        description="Gestiona créditos disponibles de clientes. Se aplican automáticamente a facturas impagas."
        badges={['Créditos manuales', 'Aplicación automática']}
      />

      {/* Buscador */}
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardContent className="p-6">
          <Label className="text-sm font-medium text-slate-700">Buscar cliente por email</Label>
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="cliente@email.com"
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedEmail && (
        <>
          {/* Tarjeta de saldo + acción */}
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-card">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-emerald-700 font-medium">Saldo a favor de</p>
                  <p className="text-lg font-semibold text-slate-800 truncate">{selectedEmail}</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <Wallet className="h-7 w-7 text-emerald-600" />
                    <span className="text-4xl font-bold text-emerald-700">${balance.toFixed(2)}</span>
                    <span className="text-sm text-slate-500">disponible</span>
                  </div>
                </div>
                <Button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4 mr-1" /> Añadir saldo
                </Button>
              </div>

              {showAddForm && (
                <div className="mt-4 pt-4 border-t border-emerald-200 space-y-3 bg-white/60 rounded-lg p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-600">Monto (USD)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newCredit.amount}
                        onChange={(e) => setNewCredit({ ...newCredit, amount: e.target.value })}
                        placeholder="100.00"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Tipo</Label>
                      <select
                        className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                        value={newCredit.type}
                        onChange={(e) => setNewCredit({ ...newCredit, type: e.target.value })}
                      >
                        <option value="credito">Crédito (saldo a favor)</option>
                        <option value="ajuste">Ajuste (corrección)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Descripción / Motivo</Label>
                    <Textarea
                      value={newCredit.description}
                      onChange={(e) => setNewCredit({ ...newCredit, description: e.target.value })}
                      placeholder="Ej: Sobre pago, error en cobro, abono sin factura..."
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Referencia (opcional)</Label>
                    <Input
                      value={newCredit.reference}
                      onChange={(e) => setNewCredit({ ...newCredit, reference: e.target.value })}
                      placeholder="Nº de transferencia, nota, etc."
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
                    <Button onClick={handleAddCredit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                      Guardar y aplicar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historial de movimientos */}
          <Card className="border-border/70 bg-card/95 shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-slate-600" />
                <h3 className="font-semibold text-slate-800">Historial de movimientos</h3>
                <Badge variant="outline">{credits.length}</Badge>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : credits.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No hay movimientos registrados para este cliente.</p>
              ) : (
                <div className="space-y-2">
                  {credits.map((c) => {
                    const isCredit = num(c.amount) > 0;
                    return (
                      <div
                        key={c.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-white hover:bg-slate-50 transition-colors"
                      >
                        <div className={`mt-0.5 p-2 rounded-lg ${isCredit ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                          {isCredit ? <ArrowUpCircle className="h-4 w-4 text-emerald-600" /> : <ArrowDownCircle className="h-4 w-4 text-amber-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold text-sm ${isCredit ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {isCredit ? '+' : ''}${num(c.amount).toFixed(2)}
                            </span>
                            <Badge variant="outline" className="text-xs capitalize">
                              {c.type === 'credito' ? 'Crédito' : c.type === 'uso' ? 'Uso automático' : 'Ajuste'}
                            </Badge>
                            {c.related_invoice_number && (
                              <Badge variant="outline" className="text-xs">Factura: {c.related_invoice_number}</Badge>
                            )}
                          </div>
                          {c.description && (
                            <p className="text-sm text-slate-600 mt-0.5 break-words">{c.description}</p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            {format(new Date(c.created_date), 'dd/MM/yyyy HH:mm')}
                            {c.created_by_email && c.created_by_email !== 'system' && ` · por ${c.created_by_email}`}
                            {c.reference && ` · Ref: ${c.reference}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedEmail && (
        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="h-14 w-14 text-slate-300 mb-3" />
            <p className="text-slate-500">Busca un cliente por email para ver y gestionar su saldo a favor.</p>
            <p className="text-sm text-slate-400 mt-1">El saldo se aplica automáticamente a las facturas impagas del cliente.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}