import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Target, Eye, LayoutTemplate } from 'lucide-react';

const STORAGE_KEY = 'admin.designPhaseOne.v1';
const defaultForm = {
  visualGoal: 'Lujo silencioso, moderno y confiable',
  targetUser: 'Clientes y administradores que esperan una experiencia premium, clara y profesional',
  currentPainPoints: '',
  mustKeep: '',
  benchmarkApps: '',
  quickWins: '',
};

const criteria = [
  'Menos ruido visual y más espacio en blanco',
  'Jerarquía clara en títulos, números y acciones',
  'Componentes consistentes y más sobrios',
  'Colores, tipografía e iconos con un solo lenguaje',
];

export default function DesignPhaseOneStudio() {
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setForm({ ...defaultForm, ...JSON.parse(saved) });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <Card className="border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5" />
            Fase 1 · Estrategia de rediseño premium
          </CardTitle>
          <CardDescription className="text-slate-300">
            Aquí defines la percepción aspiracional, detectas lo que hoy se siente barato y alineas la dirección visual antes del rediseño UI/UX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {criteria.map((item) => (
              <Badge key={item} variant="secondary" className="bg-white/10 text-white hover:bg-white/10">
                {item}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-slate-300">Guardado automático local para que puedas trabajar esta fase sin tocar la operación de la app.</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl border-slate-200 shadow-sm xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Eye className="h-4 w-4" /> Diagnóstico actual</CardTitle>
            <CardDescription>Define lo que hoy da sensación económica y qué elementos sí vale la pena conservar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Qué se ve barato hoy</Label>
              <Textarea value={form.currentPainPoints} onChange={(e) => updateField('currentPainPoints', e.target.value)} rows={6} placeholder="Ej: demasiados colores, tarjetas pesadas, poca jerarquía, exceso de texto, botones genéricos..." />
            </div>
            <div className="space-y-2">
              <Label>Qué debemos mantener</Label>
              <Textarea value={form.mustKeep} onChange={(e) => updateField('mustKeep', e.target.value)} rows={5} placeholder="Ej: claridad operativa, rapidez, módulos clave, branding actual, estructura del sidebar..." />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Target className="h-4 w-4" /> Dirección premium</CardTitle>
            <CardDescription>Define la sensación que quieres provocar y para quién debe sentirse de alto nivel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Meta visual</Label>
              <Input value={form.visualGoal} onChange={(e) => updateField('visualGoal', e.target.value)} placeholder="Ej: minimalista, sobria, confiable y de alto ticket" />
            </div>
            <div className="space-y-2">
              <Label>Usuario objetivo</Label>
              <Textarea value={form.targetUser} onChange={(e) => updateField('targetUser', e.target.value)} rows={4} placeholder="Describe el tipo de cliente/administrador que debe sentir la app como premium" />
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Prioridad UX para la siguiente fase: simplificar pantallas, elevar contraste útil, mejorar ritmo visual y hacer que cada acción importante se vea intencional.
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm xl:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><LayoutTemplate className="h-4 w-4" /> Benchmarks y quick wins</CardTitle>
            <CardDescription>Reúne referencias y detecta cambios rápidos que eleven la percepción sin tocar la lógica.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Apps o marcas de referencia</Label>
              <Textarea value={form.benchmarkApps} onChange={(e) => updateField('benchmarkApps', e.target.value)} rows={5} placeholder="Ej: Linear, Notion, Ramp, Apple Wallet..." />
            </div>
            <div className="space-y-2">
              <Label>Mejoras rápidas para fase 2</Label>
              <Textarea value={form.quickWins} onChange={(e) => updateField('quickWins', e.target.value)} rows={5} placeholder="Ej: nueva tipografía, tarjetas más limpias, sidebar más sobrio, mejor espaciado, hero premium..." />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}