import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, Loader2, Tags } from 'lucide-react';
import ClientSearchBox from '@/components/manual-billing/ClientSearchBox';
import DispatchLabelClientCard from '@/components/warehouse/dispatch-labels/DispatchLabelClientCard';
import BoxQuantityCard from '@/components/warehouse/dispatch-labels/BoxQuantityCard';
import LabelBatchResult from '@/components/warehouse/dispatch-labels/LabelBatchResult';
import LabelPrintHistory from '@/components/warehouse/dispatch-labels/LabelPrintHistory';
import BultoAuditPanel from '@/components/admin/bulto-audit/BultoAuditPanel';
import useLabelBatch from '@/components/warehouse/dispatch-labels/useLabelBatch';

// Etiquetas de Despacho: se elige el cliente y cuántas cajas van a salir. Se imprime una
// etiqueta por caja con los datos del cliente y el X/N de esa cantidad y, al confirmarse
// la impresión, se crea la guía de despacho con esas cajas.
// La Auditoría de Bultos vive aquí mismo, en su propia pestaña.
const TAB_HEADERS = {
  etiquetas: {
    title: 'Etiquetas de Despacho',
    description: 'Elige el cliente, escribe cuántas cajas van a salir e imprime su etiqueta. La guía de despacho se crea sola al confirmarse la impresión, y cada impresión queda en el historial del cliente para reimprimir la etiqueta cuando haga falta.',
    icon: Tags,
  },
  auditoria: {
    title: 'Auditoría de Bultos',
    description: 'Registro completo de qué empleado procesó cada bulto y a qué hora, con los paquetes incluidos.',
    icon: History,
  },
};

export default function DispatchLabels() {
  const navigate = useNavigate();
  const batch = useLabelBatch();
  const [tab, setTab] = useState('etiquetas');

  const header = TAB_HEADERS[tab] || TAB_HEADERS.etiquetas;
  const HeaderIcon = header.icon;

  return (
    <div className={`mx-auto space-y-5 ${tab === 'auditoria' ? 'max-w-7xl' : 'max-w-4xl'}`}>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <HeaderIcon className="h-6 w-6 text-blue-600" /> {header.title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{header.description}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="grid w-full grid-cols-2 sm:max-w-md">
          <TabsTrigger value="etiquetas">Etiquetas de Despacho</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría de Bultos</TabsTrigger>
        </TabsList>

        <TabsContent value="etiquetas" className="space-y-5">
          {!batch.client ? (
            <Card>
              <CardContent className="space-y-3 p-4">
                <p className="text-xs text-slate-500">Busca al cliente para imprimir su etiqueta.</p>
                <ClientSearchBox onSelect={batch.selectClient} />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <DispatchLabelClientCard client={batch.client} onChange={batch.clearClient} />

              {batch.loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <BoxQuantityCard
                  quantity={batch.quantity}
                  onQuantityChange={batch.setQuantity}
                  pendingCount={batch.pendingCount}
                  printing={batch.printing}
                  progress={batch.progress}
                  statusText={batch.statusText}
                  onPrint={batch.printBatch}
                />
              )}

              <LabelBatchResult
                guide={batch.result?.guide}
                excluded={batch.result?.excluded || []}
                printedCount={batch.printedCount}
                creating={batch.creating}
                onRetryCreate={batch.retryCreate}
                onOpenGuides={() =>
                  navigate('/DispatchGuides', { state: { highlightGuideId: batch.result?.guide?.id || '' } })
                }
              />

              <LabelPrintHistory
                clientEmail={batch.client?.email}
                refreshKey={batch.historyKey}
                reprintingId={batch.reprintingId}
                onReprint={batch.reprint}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="auditoria" className="space-y-5">
          <BultoAuditPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}