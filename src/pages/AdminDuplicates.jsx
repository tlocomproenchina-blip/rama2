import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  Users, 
  Phone, 
  Package, 
  CreditCard,
  ShieldAlert,
  CheckCircle,
  Tag
} from 'lucide-react';
import { toast } from 'sonner';
import DuplicateCedulaList from '@/components/duplicates/DuplicateCedulaList';
import DuplicateWhatsappList from '@/components/duplicates/DuplicateWhatsappList';
import DuplicateTrackingList from '@/components/duplicates/DuplicateTrackingList';
import DuplicateShippingMarkList from '@/components/duplicates/DuplicateShippingMarkList';
import ClientListTable from '@/components/duplicates/ClientListTable';

export default function AdminDuplicates({ user }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [lastScan, setLastScan] = useState(null);

  const runScan = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('checkDuplicates', { action: 'full_scan' });
      setData(res.data);
      setLastScan(new Date());
      const s = res.data.summary;
      if (s.duplicateCedulaCount + s.duplicateWhatsappCount + s.duplicateTrackingCount + (s.duplicateShippingMarkCount || 0) === 0) {
        toast.success('No se encontraron duplicados');
      } else {
        toast.warning(`Se encontraron duplicados en el sistema`);
      }
    } catch (err) {
      toast.error('Error al escanear: ' + (err?.message || 'Error'));
    }
    setLoading(false);
  };

  useEffect(() => {
    runScan();
  }, []);

  const totalDuplicates = data ? 
    (data.summary.duplicateCedulaCount + data.summary.duplicateWhatsappCount + data.summary.duplicateTrackingCount + (data.summary.duplicateShippingMarkCount || 0)) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-amber-500" />
            Detector de Duplicados
          </h1>
          <p className="text-slate-500 mt-1">Identifica registros duplicados en el sistema para mantener la integridad de los datos</p>
        </div>
        <Button onClick={runScan} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Escanear Sistema
        </Button>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard
            icon={Users}
            label="Clientes Analizados"
            value={data.summary.totalClients}
            color="blue"
          />
          <SummaryCard
            icon={CreditCard}
            label="Cédulas Duplicadas"
            value={data.summary.duplicateCedulaCount}
            color={data.summary.duplicateCedulaCount > 0 ? 'red' : 'green'}
            alert={data.summary.duplicateCedulaCount > 0}
          />
          <SummaryCard
            icon={Phone}
            label="Teléfonos Duplicados"
            value={data.summary.duplicateWhatsappCount}
            color={data.summary.duplicateWhatsappCount > 0 ? 'red' : 'green'}
            alert={data.summary.duplicateWhatsappCount > 0}
          />
          <SummaryCard
            icon={Tag}
            label="Shipping Marks Duplicados"
            value={data.summary.duplicateShippingMarkCount || 0}
            color={(data.summary.duplicateShippingMarkCount || 0) > 0 ? 'red' : 'green'}
            alert={(data.summary.duplicateShippingMarkCount || 0) > 0}
          />
          <SummaryCard
            icon={Package}
            label="Trackings Duplicados"
            value={data.summary.duplicateTrackingCount}
            color={data.summary.duplicateTrackingCount > 0 ? 'red' : 'green'}
            alert={data.summary.duplicateTrackingCount > 0}
          />
        </div>
      )}

      {loading && !data && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-slate-600">Escaneando sistema en busca de duplicados...</p>
          </CardContent>
        </Card>
      )}

      {/* Always show tabs when data is loaded */}
      {data && (
        <Tabs defaultValue="clientes">
          <TabsList className="flex w-full p-1">
            <TabsTrigger value="clientes" className="flex-1 gap-2">
              <Users className="h-4 w-4" />
              Clientes
              <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">{data.summary.totalClients}</Badge>
            </TabsTrigger>
            <TabsTrigger value="cedulas" className="flex-1 gap-2">
              <CreditCard className="h-4 w-4" />
              Cédulas
              {data.summary.duplicateCedulaCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{data.summary.duplicateCedulaCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex-1 gap-2">
              <Phone className="h-4 w-4" />
              Teléfonos
              {data.summary.duplicateWhatsappCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{data.summary.duplicateWhatsappCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="shipping_marks" className="flex-1 gap-2">
              <Tag className="h-4 w-4" />
              SM
              {(data.summary.duplicateShippingMarkCount || 0) > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{data.summary.duplicateShippingMarkCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="trackings" className="flex-1 gap-2">
              <Package className="h-4 w-4" />
              Trackings
              {data.summary.duplicateTrackingCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{data.summary.duplicateTrackingCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clientes">
            <ClientListTable clients={data.clientList || []} summary={data.summary} />
          </TabsContent>
          <TabsContent value="cedulas">
            <DuplicateCedulaList items={data.duplicateCedulas} />
          </TabsContent>
          <TabsContent value="whatsapp">
            <DuplicateWhatsappList items={data.duplicateWhatsapp} />
          </TabsContent>
          <TabsContent value="shipping_marks">
            <DuplicateShippingMarkList items={data.duplicateShippingMarks || []} />
          </TabsContent>
          <TabsContent value="trackings">
            <DuplicateTrackingList items={data.duplicateTrackings} />
          </TabsContent>
        </Tabs>
      )}

      {lastScan && (
        <p className="text-xs text-slate-400 text-center">Último escaneo: {lastScan.toLocaleString('es-VE')}</p>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color, alert }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    green: 'bg-green-50 text-green-600 border-green-200',
  };
  return (
    <Card className={`border ${alert ? 'border-red-200 bg-red-50/50' : 'border-border/70'}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          {alert ? <AlertTriangle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}