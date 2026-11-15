import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Loader2, Trash2, UserPlus } from 'lucide-react';
import WholesalerBrandCard from './WholesalerBrandCard';

// Cuentas individuales del mayorista seleccionado: cada una entra a /MiPortalMayorista.
export default function WholesalerAccountsPanel({ wholesalerKey }) {
  const [state, setState] = useState(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const call = (action, extra = {}) => base44.functions.invoke('wholesalerAccounts', { action, wholesaler_key: wholesalerKey, ...extra });
  const load = useCallback(() => { if (wholesalerKey) call('admin_list').then((r) => setState(r.data)); }, [wholesalerKey]);
  useEffect(() => { setState(null); load(); }, [load]);

  if (!wholesalerKey) return <p className="py-8 text-center text-muted-foreground">Selecciona un mayorista.</p>;
  if (!state) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const add = async () => {
    setBusy(true);
    try {
      await call('admin_add', { email });
      await base44.users.inviteUser(email.trim().toLowerCase(), 'user').catch(() => null);
      toast.success('Cuenta asignada e invitación enviada');
      setEmail('');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'No se pudo asignar');
    }
    setBusy(false);
  };
  const act = async (action, id) => { await call(action, { id }); load(); };
  const portalUrl = `${window.location.origin}/MiPortalMayorista`;

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card><CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display font-semibold">Cuentas del mayorista</h3>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(portalUrl); toast.success('Enlace copiado'); }}><Copy />Copiar enlace del portal</Button>
        </div>
        <div className="flex gap-2">
          <Input type="email" placeholder="email@mayorista.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={add} disabled={busy || !email}>{busy ? <Loader2 className="animate-spin" /> : <UserPlus />}Asignar</Button>
        </div>
        {state.users.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay cuentas asignadas.</p>}
        {state.users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
            <div>
              <p className="font-medium">{u.email}</p>
              <p className="text-xs text-muted-foreground">{u.last_access_date ? `Último acceso ${new Date(u.last_access_date).toLocaleString('es-VE')}` : 'Sin accesos aún'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={u.active === false ? 'secondary' : 'default'}>{u.active === false ? 'Suspendida' : 'Activa'}</Badge>
              <Button variant="outline" size="sm" onClick={() => act('admin_toggle', u.id)}>{u.active === false ? 'Activar' : 'Suspender'}</Button>
              <Button variant="ghost" size="icon" onClick={() => act('admin_remove', u.id)}><Trash2 /></Button>
            </div>
          </div>
        ))}
      </CardContent></Card>
      <WholesalerBrandCard wholesalerKey={wholesalerKey} brand={state.brand} onSaved={load} />
    </div>
  );
}