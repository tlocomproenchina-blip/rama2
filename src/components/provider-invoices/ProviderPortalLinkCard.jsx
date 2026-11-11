import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link2, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AccessPasswordEditor from '@/components/common/AccessPasswordEditor';
import { piCall, portalUrl } from '@/lib/providerInvoicesApi';

export default function ProviderPortalLinkCard() {
  const [token, setToken] = useState('');
  const [passwordSet, setPasswordSet] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { piCall('getPortalLink').then((d) => { setToken(d.token); setPasswordSet(!!d.password_set); }); }, []);

  const url = token ? portalUrl(token) : '';
  const copy = async () => { await navigator.clipboard.writeText(url); toast.success('Enlace copiado'); };
  const regenerate = async () => {
    if (!window.confirm('El enlace actual dejará de funcionar. ¿Generar uno nuevo?')) return;
    setBusy(true);
    const d = await piCall('regeneratePortalLink');
    setToken(d.token); setPasswordSet(!!d.password_set); setBusy(false);
    toast.success('Nuevo enlace generado');
  };
  const savePassword = async (password) => {
    const d = await piCall('setPortalPassword', { password });
    setPasswordSet(!!d.password_set);
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold">Enlace público para proveedores</p>
        <p className="text-xs text-muted-foreground">Quien tenga este enlace puede ver el historial, crear facturas y cargar la foto, sin iniciar sesión. No puede marcar pagos ni cambiar la tarifa.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input readOnly value={url || 'Generando…'} className="min-w-[280px] flex-1 font-mono text-xs" />
          <Button size="sm" variant="outline" onClick={copy} disabled={!url}><Link2 />Copiar</Button>
          <Button size="sm" variant="outline" asChild disabled={!url}><a href={url} target="_blank" rel="noreferrer"><ExternalLink />Abrir</a></Button>
          <Button size="sm" variant="ghost" onClick={regenerate} disabled={busy || !url}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}Regenerar</Button>
        </div>
        {token && (
          <div className="border-t border-border/70 pt-3">
            <AccessPasswordEditor isSet={passwordSet} onSave={savePassword} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}