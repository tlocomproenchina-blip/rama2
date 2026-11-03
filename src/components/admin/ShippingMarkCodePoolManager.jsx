import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, ListPlus, Hash } from 'lucide-react';
import { toast } from 'sonner';

// Auto-formatea: N2TLECW1825S → N2-TLEC-W1825S
const autoFormatCode = (raw) => {
  const clean = String(raw).trim().toUpperCase();
  if (!clean) return '';
  // Si ya tiene formato correcto, devolver tal cual
  if (/^N\d+-TLEC-[A-Z0-9]+$/.test(clean)) return clean;
  // Si viene sin guiones (N#TLEC...), agregarlos
  const m = clean.match(/^(N\d+)TLEC([A-Z0-9]+)$/);
  if (m) return `${m[1]}-TLEC-${m[2]}`;
  return clean; // formato no reconocido — se filtrará luego
};

const isValidCode = (code) => /^N\d+-TLEC-[A-Z0-9]+$/.test(code);

const normalizeCodes = (value = '') => {
  return Array.from(new Set(
    String(value)
      .split(/[\n,;]+/)
      .map((item) => autoFormatCode(item))
      .filter(Boolean)
  ));
};

export default function ShippingMarkCodePoolManager() {
  const [codesInput, setCodesInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, available: 0, assigned: 0 });

  const parsedCodes = useMemo(() => normalizeCodes(codesInput), [codesInput]);
  const validCodes = useMemo(() => parsedCodes.filter(isValidCode), [parsedCodes]);
  const invalidCodes = useMemo(() => parsedCodes.filter((c) => !isValidCode(c)), [parsedCodes]);

  const loadStats = async () => {
    try {
      setLoading(true);
      // Contadores en el servidor: no se descargan los códigos
      const [total, available, assigned] = await Promise.all([
        base44.entities.ShippingMarkCode.count({}),
        base44.entities.ShippingMarkCode.count({ status: 'available' }),
        base44.entities.ShippingMarkCode.count({ status: 'assigned' }),
      ]);
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
    if (!validCodes.length) {
      toast.error('Pega al menos un código con formato válido (N#-TLEC-XXXXX)');
      return;
    }

    if (invalidCodes.length) {
      toast.error(`${invalidCodes.length} código(s) tienen formato inválido y serán ignorados`);
    }

    try {
      setSaving(true);
      // Solo se consultan los códigos pegados que ya existan, en bloques
      const existingSet = new Set();
      for (let i = 0; i < validCodes.length; i += 200) {
        const chunk = validCodes.slice(i, i + 200);
        const found = await base44.entities.ShippingMarkCode.filter({ code: { $in: chunk } }, '-created_date', chunk.length);
        found.forEach((item) => existingSet.add(String(item.code || '').trim().toUpperCase()));
      }
      const newItems = validCodes
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
        <Card className="rounded-2xl border-sky-200 bg-white/70 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Disponibles</p>
              <p className="text-2xl font-bold text-slate-800">{loading ? '—' : stats.available}</p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Activos</Badge>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-sky-200 bg-white/70 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Asignados</p>
              <p className="text-2xl font-bold text-slate-800">{loading ? '—' : stats.assigned}</p>
            </div>
            <Badge className="bg-slate-100 text-slate-700 border-slate-200">Usados</Badge>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-sky-200 bg-white/70 shadow-sm">
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
        <div className="text-xs space-y-1">
          <p className="text-slate-500">
            Se detectaron <span className="font-semibold text-emerald-700">{validCodes.length}</span> código(s) válido(s)
            {invalidCodes.length > 0 && (
              <> y <span className="font-semibold text-rose-600">{invalidCodes.length}</span> con formato inválido (serán ignorados)</>
            )}.
          </p>
          <p className="text-slate-400">
            Formato esperado: <code className="bg-slate-100 px-1 rounded">N#-TLEC-XXXXX</code>. Códigos sin guiones se ajustan automáticamente.
          </p>
          {invalidCodes.length > 0 && (
            <p className="text-rose-600 truncate">Inválidos: {invalidCodes.slice(0, 5).join(', ')}{invalidCodes.length > 5 ? '…' : ''}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={handleLoadCodes} disabled={saving || !validCodes.length} className="bg-sky-600 hover:bg-sky-700">
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