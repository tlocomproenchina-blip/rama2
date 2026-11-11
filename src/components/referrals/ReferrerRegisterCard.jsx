import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import ReferralTerms from './ReferralTerms';

export default function ReferrerRegisterCard({ me, onDone }) {
  const [f, setF] = useState({
    full_name: [me?.first_name, me?.last_name].filter(Boolean).join(' ') || me?.full_name || '',
    id_number: me?.cedula || '', phone: me?.whatsapp || '', contact_email: me?.email || '',
  });
  const [accept, setAccept] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    setSaving(true); setError('');
    const { data } = await base44.functions.invoke('referralProgram', { action: 'register', ...f, accept_terms: accept }).catch((e) => ({ data: e?.response?.data || { error: 'No se pudo enviar' } }));
    setSaving(false);
    if (data?.error) return setError(data.error);
    onDone();
  };

  return (
    <Card className="border-border/70 shadow-card">
      <CardContent className="grid gap-8 p-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Únete al programa</p>
            <h2 className="mt-1 font-display text-2xl font-bold">Regístrate como referidor</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tu registro será revisado por el equipo. Al aprobarlo recibirás tu código.</p>
          </div>
          {[['full_name', 'Nombre completo'], ['id_number', 'Cédula / identificación'], ['phone', 'Teléfono'], ['contact_email', 'Correo electrónico']].map(([k, l]) => (
            <div key={k} className="space-y-1.5"><Label>{l}</Label><Input value={f[k]} onChange={set(k)} /></div>
          ))}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={accept} onCheckedChange={(v) => setAccept(!!v)} className="mt-0.5" />
            Leí y acepto los Términos y Condiciones del Programa de Referidos.
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={submit} disabled={saving || !accept} className="w-full">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enviar solicitud
          </Button>
        </div>
        <ScrollArea className="h-[460px] rounded-xl border bg-muted/40 p-4"><ReferralTerms /></ScrollArea>
      </CardContent>
    </Card>
  );
}