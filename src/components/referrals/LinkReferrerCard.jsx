import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, UserCheck } from 'lucide-react';

export default function LinkReferrerCard({ referrer, onDone }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (referrer) {
    return (
      <Card className="border-border/70 shadow-card"><CardContent className="flex items-center gap-3 p-5 text-sm">
        <UserCheck className="h-5 w-5 text-success" />
        <span>Tu referidor registrado: <b>{referrer.name}</b> {referrer.code && <span className="text-muted-foreground">({referrer.code})</span>}</span>
      </CardContent></Card>
    );
  }
  const submit = async () => {
    setBusy(true); setError('');
    const { data } = await base44.functions.invoke('referralProgram', { action: 'link', code }).catch((e) => ({ data: e?.response?.data || { error: 'No se pudo vincular' } }));
    setBusy(false);
    if (data?.error) return setError(data.error);
    onDone();
  };
  return (
    <Card className="border-border/70 shadow-card"><CardContent className="space-y-3 p-5">
      <div>
        <p className="font-display font-semibold">¿Te refirió alguien?</p>
        <p className="text-sm text-muted-foreground">Indica su código antes de que tu primera carga zarpe desde China. Después no podrá vincularse.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="TLEC-XXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <Button onClick={submit} disabled={busy || !code.trim()}>{busy && <Loader2 className="animate-spin" />} Vincular</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </CardContent></Card>
  );
}