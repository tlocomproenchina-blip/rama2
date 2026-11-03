import React, { useState } from 'react';
import { KeyRound, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function PortalAccessGate({ onSubmit, error, loading, label }) {
  const [code, setCode] = useState('');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(code.trim());
        }}
        className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
            <Lock className="h-5 w-5 text-foreground" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-foreground">Portal de consulta</p>
            <p className="text-xs text-muted-foreground">{label || 'Este enlace pide código de acceso'}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="portal-code" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Código de acceso
          </Label>
          <Input
            id="portal-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Introduce el código que te dieron"
            className="h-11"
            autoComplete="off"
          />
          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
        </div>

        <Button type="submit" disabled={loading} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          Entrar al portal
        </Button>
      </form>
    </div>
  );
}