import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Wallet, Plus, Loader2, Search, TrendingUp, CheckCircle2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import PageHero from '@/components/common/PageHero';
import ProviderCreditForm from '@/components/provider-credits/ProviderCreditForm';
import ProviderCreditCard from '@/components/provider-credits/ProviderCreditCard';
import useFileViewer from '@/hooks/useFileViewer';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function AdminProviderCredits() {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('disponibles'); // todos | disponibles | usados
  const [search, setSearch] = useState('');

  const fileViewer = useFileViewer();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const records = await base44.entities.ProviderCredit.list('-payment_date', 500);
      setCredits(records || []);
    } catch {
      toast.error('Error al cargar los saldos a favor de proveedores');
      setCredits([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Totales generales
  const totalDisponible = credits
    .filter((c) => c.status === 'disponible')
    .reduce((sum, c) => sum + num(c.credit_amount), 0);
  const totalUsado = credits
    .filter((c) => c.status === 'usado')
    .reduce((sum, c) => sum + num(c.used_amount), 0);
  const totalGeneral = totalDisponible + totalUsado;

  // Filtrado
  const filtered = credits.filter((c) => {
    if (filter === 'disponibles' && c.status !== 'disponible') return false;
    if (filter === 'usados' && c.status !== 'usado') return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        c.provider_name?.toLowerCase().includes(q) ||
        c.invoice_number?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSave = async (data) => {
    setSaving(true);
    try {
      let currentUser = null;
      try {
        currentUser = await base44.auth.me();
      } catch (_) {}
      await base44.entities.ProviderCredit.create({
        ...data,
        status: 'disponible',
        used_amount: 0,
        created_by_email: currentUser?.email || '',
      });
      toast.success('Saldo a favor registrado correctamente');
      setShowForm(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Error al guardar el saldo a favor');
    }
    setSaving(false);
  };

  const handleMarkUsed = async (credit, amount, description) => {
    try {
      const isFullUse = amount >= num(credit.credit_amount);
      await base44.entities.ProviderCredit.update(credit.id, {
        status: 'usado',
        used_amount: amount,
        used_date: new Date().toISOString(),
        used_description: description || (isFullUse ? 'Uso total del saldo a favor' : `Uso parcial: $${amount.toFixed(2)}`),
      });
      toast.success(`Saldo a favor de $${amount.toFixed(2)} marcado como usado`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Error al marcar como usado');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHero
        icon={Wallet}
        title="Saldos a Favor de Proveedores"
        description="Registra sobre pagos a proveedores. Calcula automáticamente el monto a favor y márcalo como usado al aplicarlo."
        badges={['Sobre pagos', 'Cálculo automático', 'Uso parcial o total']}
      />

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard
          icon={DollarSign}
          label="Total General"
          value={totalGeneral}
          color="slate"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Disponible para usar"
          value={totalDisponible}
          color="emerald"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Ya usado"
          value={totalUsado}
          color="amber"
        />
      </div>

      {/* Barra de acciones */}
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <FilterButton active={filter === 'disponibles'} onClick={() => setFilter('disponibles')} label="Disponibles" count={credits.filter((c) => c.status === 'disponible').length} />
              <FilterButton active={filter === 'usados'} onClick={() => setFilter('usados')} label="Usados" count={credits.filter((c) => c.status === 'usado').length} />
              <FilterButton active={filter === 'todos'} onClick={() => setFilter('todos')} label="Todos" count={credits.length} />
            </div>
            <Button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-1" /> Nuevo saldo a favor
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por proveedor o N° de factura..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Formulario */}
      {showForm && (
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-card">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Registrar sobre pago a proveedor</h3>
            <ProviderCreditForm
              onSave={handleSave}
              onCancel={() => setShowForm(false)}
              saving={saving}
            />
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="h-5 w-5 text-slate-600" />
            <h3 className="font-semibold text-slate-800">Saldos a favor registrados</h3>
            <Badge variant="outline">{filtered.length}</Badge>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500">
                {filter === 'disponibles' ? 'No hay saldos a favor disponibles para usar.' : filter === 'usados' ? 'No hay saldos a favor marcados como usados.' : 'No hay saldos a favor registrados todavía.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((credit) => (
                <ProviderCreditCard
                  key={credit.id}
                  credit={credit}
                  onMarkUsed={handleMarkUsed}
                  onViewFile={fileViewer.open}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {fileViewer.modal}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-2">${value.toFixed(2)}</p>
    </div>
  );
}

function FilterButton({ active, onClick, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-emerald-600 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label} <span className="text-xs opacity-70">({count})</span>
    </button>
  );
}