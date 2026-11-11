import React, { useState } from 'react';
import { Lock, LockOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Define, cambia o quita la contraseña de ingreso de un enlace público.
export default function AccessPasswordEditor({ isSet, onSave }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (password) => {
    setBusy(true);
    try {
      await onSave(password);
      setValue('');
      toast.success(password ? 'Contraseña guardada' : 'Contraseña quitada');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'No se pudo guardar la contraseña');
    }
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">Contraseña de ingreso</p>
        {isSet
          ? <Badge className="bg-green-100 text-green-700"><Lock className="mr-1 h-3 w-3" />Protegido</Badge>
          : <Badge variant="outline"><LockOpen className="mr-1 h-3 w-3" />Sin contraseña</Badge>}
      </div>
      <p className="text-xs text-muted-foreground">Si la defines, quien abra el enlace tendrá que escribirla para entrar. Guárdala: por seguridad no se puede volver a ver, solo cambiar.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="password" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="new-password"
          placeholder={isSet ? 'Nueva contraseña' : 'Escribe una contraseña'} className="min-w-[220px] flex-1" />
        <Button size="sm" onClick={() => save(value.trim())} disabled={busy || value.trim().length < 4}>
          {busy && <Loader2 className="animate-spin" />}{isSet ? 'Cambiar' : 'Guardar'}
        </Button>
        {isSet && <Button size="sm" variant="ghost" onClick={() => save('')} disabled={busy}>Quitar</Button>}
      </div>
    </div>
  );
}