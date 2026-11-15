import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';
import WholesalerPortalView from '@/components/wholesaler/portal/WholesalerPortalView';

// Portal del mayorista con cuenta individual: el servidor decide qué mayorista ve.
export default function MiPortalMayorista() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    base44.auth.isAuthenticated().then((ok) => {
      if (!ok) return base44.auth.redirectToLogin(window.location.href);
      base44.functions.invoke('wholesalerAccounts', { action: 'me' })
        .then((res) => setData(res.data))
        .catch((err) => setError(err?.response?.data?.error || 'No se pudo cargar el portal'));
    });
  }, []);

  const logout = <Button variant="outline" onClick={() => base44.auth.logout()}><LogOut /> Cerrar sesión</Button>;
  if (error) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground">{error}</p>{logout}
    </div>
  );
  if (!data) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  return <WholesalerPortalView data={data} headerAction={logout} />;
}