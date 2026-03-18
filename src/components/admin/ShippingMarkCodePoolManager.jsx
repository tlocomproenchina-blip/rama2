import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, ListPlus, Hash } from 'lucide-react';
import { toast } from 'sonner';

const normalizeCodes = (value = '') => {
  return Array.from(new Set(
    String(value)
      .split(/[\n,;]+/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
  ));
};

export default function ShippingMarkCodePoolManager() {
  const [codesInput, setCodesInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, available: 0, assigned: 0 });

  const parsedCodes = useMemo(() => normalizeCodes(codesInput), [codesInput]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const codes = await base44.entities.ShippingMarkCode.list('-created_date', 5000);
      const total = codes.length;
      const available = codes.filter((item) => item.status === 'available').length;
      const assigned = codes.filter((item) => item.status === 'assigned').length;
      setStats({ total, available, assigned });
    } catch (_) {
      toast.error('No se pudieron cargar los códigos disponibles');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleLoadCodes = async () => {
    if (!parsedCodes.length) {
      toast.error('Pega al menos un código');
      return;
    }

    try {
      setSaving(true);
      const existing = await base44.entities.ShippingMarkCode.list('-created_date', 5000);
      const existingSet = new Set(existing.map((item) => String(item.code || '').trim().toUpperCase()));
      const newItems = parsedCodes
        .filter((code) => !existingSet.has(code))
        .map((code) => ({ code, status: 'available' }));

      if (!newItems.length) {
        toast.error('Todos esos códigos ya estaban cargados');
        setSaving(false);
        return;
      }

      await base44.entities.ShippingMarkCode.bulkCreate(newItems);
      setCodesInput('');
      await loadStats();
      toast.success(`${newItems.length} códigos cargados`);
    } catch (_) {
      toast.error('No se pudieron cargar los códigos');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-sky-200 bg-white/70 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Disponibles</p>
              <p className="text-2xl font-bold text-slate-800">{loading ? '—' : stats.available}</p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Activos</Badge>
          </CardContent>
        </Card>
        <Card className="border-sky-200 bg-white/70 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Asignados</p>
              <p className="text-2xl font-bold text-slate-800">{loading ? '—' : stats.assigned}</p>
            </div>
            <Badge className="bg-slate-100 text-slate-700 border-slate-200">Usados</Badge>
          </CardContent>
        </Card>
        <Card className="border-sky-200 bg-white/70 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total cargados</p>
              <p className="text-2xl font-bold text-slate-800">{loading ? '—' : stats.total}</p>
            </div>
            <Hash className="h-5 w-5 text-sky-600" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <Label>Lista de códigos disponibles</Label>
        <Textarea
          value={codesInput}
          onChange={(e) => setCodesInput(e.target.value)}
          rows={6}
          placeholder="Pega un código por línea o separados por comas"
        />
        <p className="text-xs text-slate-500">
          Se detectaron {parsedCodes.length} código(s) nuevos en la caja de carga.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={handleLoadCodes} disabled={saving || !parsedCodes.length} className="bg-sky-600 hover:bg-sky-700">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ListPlus className="h-4 w-4 mr-2" />}
          Cargar códigos
        </Button>
        <Button variant="outline" onClick={loadStats} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Actualizar contador
        </Button>
      </div>
    </div>
  );
}