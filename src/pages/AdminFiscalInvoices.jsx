import React, { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FiscalAdminList from '@/components/fiscal/admin/FiscalAdminList';
import FiscalRequestDetail from '@/components/fiscal/admin/FiscalRequestDetail';
import FiscalMethodsManager from '@/components/fiscal/admin/FiscalMethodsManager';
import FiscalIssuerSettings from '@/components/fiscal/admin/FiscalIssuerSettings';

export default function AdminFiscalInvoices() {
  const [openId, setOpenId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-accent p-3 text-primary"><ReceiptText className="h-6 w-6" /></div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Facturas fiscales</h1>
          <p className="text-sm text-muted-foreground">Finanzas: solicitudes de clientes, verificación del pago del IVA y emisión.</p>
        </div>
      </div>
      <Tabs defaultValue="solicitudes">
        <TabsList>
          <TabsTrigger value="solicitudes">Solicitudes</TabsTrigger>
          <TabsTrigger value="pagos">Configuración de pagos del IVA</TabsTrigger>
          <TabsTrigger value="emisor">Datos del emisor</TabsTrigger>
        </TabsList>
        <TabsContent value="solicitudes" className="pt-4"><FiscalAdminList onOpen={setOpenId} refreshKey={refreshKey} /></TabsContent>
        <TabsContent value="pagos" className="pt-4"><FiscalMethodsManager /></TabsContent>
        <TabsContent value="emisor" className="pt-4"><FiscalIssuerSettings /></TabsContent>
      </Tabs>
      {openId ? <FiscalRequestDetail requestId={openId} onClose={() => setOpenId(null)} onChanged={() => setRefreshKey((k) => k + 1)} /> : null}
    </div>
  );
}