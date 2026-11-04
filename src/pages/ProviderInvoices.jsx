import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import ProviderInvoiceForm from '@/components/provider-invoices/ProviderInvoiceForm';
import ProviderInvoiceHistory from '@/components/provider-invoices/ProviderInvoiceHistory';
import ProviderRateCard from '@/components/provider-invoices/ProviderRateCard';
import ProviderPortalLinkCard from '@/components/provider-invoices/ProviderPortalLinkCard';
import { piCall } from '@/lib/providerInvoicesApi';

export default function ProviderInvoices() {
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const loadCfg = () => piCall('config').then(setCfg).catch(() => setError('No tienes acceso a este módulo.'));
  useEffect(() => { loadCfg(); }, []);

  if (error) return <p className="py-20 text-center text-muted-foreground">{error}</p>;
  if (!cfg) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">Proveedores</p>
        <h1 className="font-display text-3xl font-bold">Facturas de proveedor</h1>
        <p className="text-muted-foreground">Total = tarifa plana × CBM + otros gastos</p>
      </div>
      {cfg.is_admin && <ProviderRateCard flatRate={cfg.flat_rate} onSaved={loadCfg} />}
      {cfg.is_admin && <ProviderPortalLinkCard />}
      <Tabs defaultValue="historial">
        <TabsList><TabsTrigger value="historial">Historial</TabsTrigger><TabsTrigger value="nueva">Nueva factura</TabsTrigger></TabsList>
        <TabsContent value="historial"><ProviderInvoiceHistory isAdmin={cfg.is_admin} refreshKey={refreshKey} /></TabsContent>
        <TabsContent value="nueva"><ProviderInvoiceForm flatRate={cfg.flat_rate} onCreated={() => setRefreshKey((k) => k + 1)} /></TabsContent>
      </Tabs>
    </div>
  );
}