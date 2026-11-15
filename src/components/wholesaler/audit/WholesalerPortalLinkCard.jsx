import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, KeyRound, Link2, Loader2, RefreshCw } from 'lucide-react';

// Enlace privado y contraseña del portal de un mayorista.
export default function WholesalerPortalLinkCard({ wholesalerKey }) {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');

  const call = async (action, extra = {}) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('wholesalerPortal', { action, wholesaler_key: wholesalerKey, ...extra });
      setLink(res.data.link);
      return true;
    } catch (e) { toast.error(e?.response?.data?.error || 'No se pudo completar.'); return false; }
    finally { setBusy(false); setLoading(false); }
  };
  useEffect(() => { setLoading(true); call('admin_get'); }, [wholesalerKey]);

  const url = link?.token ? `${window.location.origin}/PortalMayorista/${link.token}` : '';

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-card">
      <div><p className="font-display font-semibold">Portal privado del mayorista</p>
        <p className="text-sm text-muted-foreground">Con este enlace y su contraseña el mayorista ve solo sus clientes, trackings y facturas.</p></div>
      {url ? (
        <div className="flex gap-2"><Input readOnly value={url} className="font-mono text-xs" />
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success('Enlace copiado'); }}><Copy /> Copiar</Button></div>
      ) : <p className="text-sm text-muted-foreground">Aún no tiene enlace.</p>}
      <Button variant="outline" disabled={busy} onClick={() => call('admin_generate').then((ok) => ok && toast.success(url ? 'Enlace regenerado: el anterior dejó de funcionar' : 'Enlace generado'))}>
        {url ? <RefreshCw /> : <Link2 />} {url ? 'Regenerar enlace' : 'Generar enlace'}
      </Button>
      {url && (
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm">Contraseña: <b>{link.access_password_set ? 'configurada' : 'sin configurar (el portal no abre)'}</b></p>
          <div className="flex gap-2"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nueva contraseña (mín. 6)" />
            <Button disabled={busy || pw.length < 6} onClick={() => call('admin_password', { password: pw }).then((ok) => { if (ok) { setPw(''); toast.success('Contraseña guardada'); } })}><KeyRound /> Guardar</Button></div>
        </div>
      )}
    </div>
  );
}