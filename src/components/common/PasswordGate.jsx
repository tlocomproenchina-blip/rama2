import React, { useState } from 'react';
import { KeyRound, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Pantalla para ingresar la contraseña de un enlace público protegido.
export default function PasswordGate({ title, subtitle, error, loading, onSubmit }) {
  const [value, setValue] = useState('');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <form
        onSubmit={(e) => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); }}
        className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle || 'Este enlace está protegido con contraseña'}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="access-password">Contraseña</Label>
          <Input id="access-password" type="password" value={value} onChange={(e) => setValue(e.target.value)}
            placeholder="Escribe la contraseña que te dieron" className="h-11" autoFocus />
          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
        </div>
        <Button type="submit" disabled={loading || !value.trim()} className="h-11 w-full">
          {loading ? <Loader2 className="animate-spin" /> : <KeyRound />}
          Ingresar
        </Button>
      </form>
    </div>
  );
}