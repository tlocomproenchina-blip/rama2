import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import ProviderInvoiceForm from '@/components/provider-invoices/ProviderInvoiceForm';
import ProviderInvoiceHistory from '@/components/provider-invoices/ProviderInvoiceHistory';
import { piCall, setPortalToken, money } from '@/lib/providerInvoicesApi';

export default function ProviderPortal() {
  const { token } = useParams();
  const [cfg, setCfg] = useState(null);
  const [invalid, setInvalid] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setPortalToken(token);
    piCall('config').then(setCfg).catch(() => setInvalid(true));
    return () => setPortalToken(null);
  }, [token]);

  if (invalid) return <p className="py-20 text-center text-muted-foreground">Este enlace no es válido o fue reemplazado.</p>;
  if (!cfg) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">TLEC CARGO · Portal de proveedores</p>
          <h1 className="font-display text-3xl font-bold">Facturas de proveedor</h1>
          <p className="text-muted-foreground">Tarifa plana vigente: <b>{money(cfg.flat_rate)}</b> / CBM · Total = tarifa plana × CBM + otros gastos</p>
        </div>
        <Tabs defaultValue="historial">
          <TabsList><TabsTrigger value="historial">Historial</TabsTrigger><TabsTrigger value="nueva">Nueva factura</TabsTrigger></TabsList>
          <TabsContent value="historial"><ProviderInvoiceHistory isAdmin={false} refreshKey={refreshKey} /></TabsContent>
          <TabsContent value="nueva"><ProviderInvoiceForm flatRate={cfg.flat_rate} onCreated={() => setRefreshKey((k) => k + 1)} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}