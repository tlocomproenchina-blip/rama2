import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle2, 
  Search, 
  Loader2,
  Package,
  User,
  Calendar,
  Layers,
  Plane,
  Ship,
  Clock
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminShipmentApprovals({ user }) {
  const [consolidations, setConsolidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadConsolidations();
  }, []);

  const loadConsolidations = async () => {
    const cons = await base44.entities.Consolidation.list('-created_date');
    setConsolidations(cons);
    setLoading(false);
  };

  const filteredConsolidations = consolidations.filter(con => {
    const searchLower = search.toLowerCase();
    return (
      con.consolidation_tracking?.toLowerCase().includes(searchLower) ||
      con.client_email?.toLowerCase().includes(searchLower) ||
      con.shipping_mark?.toLowerCase().includes(searchLower) ||
      con.tracking_numbers?.some(t => t.toLowerCase().includes(searchLower))
    );
  });

  const approved = filteredConsolidations.filter(c => c.shipment_approved && !c.ready_for_dispatch);
  const pending = filteredConsolidations.filter(c => c.payment_validated && !c.shipment_approved);
  const readyForDispatch = filteredConsolidations.filter(c => c.ready_for_dispatch);

  const handleMarkReady = async (con) => {
    try {
      await base44.entities.Consolidation.update(con.id, {
        ready_for_dispatch: true
      });
      await loadConsolidations();
    } catch (error) {
      console.error('Error al marcar como listo:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const ConsolidationCard = ({ con, showReadyButton = false }) => (
    <Card className="border-0 shadow-md hover:shadow-lg transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Layers className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <h3 className="font-semibold text-slate-800 font-mono text-lg">
                  {con.consolidation_tracking}
                </h3>
                <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                  {con.shipping_type === 'aereo' 
                    ? <><Plane className="h-4 w-4" /> Aéreo</>
                    : <><Ship className="h-4 w-4" /> Marítimo</>
                  }
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="h-4 w-4" />
                  <span>{con.client_email}</span>
                </div>
                {con.shipping_mark && (
                  <Badge variant="outline" className="font-mono">
                    {con.shipping_mark}
                  </Badge>
                )}
              </div>

              {con.shipment_approved && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Aprobado: {new Date(con.shipment_approved_date).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</span>
                </div>
              )}

              <div className="pt-2">
                <p className="text-xs text-slate-500 mb-2">Paquetes incluidos:</p>
                <div className="flex flex-wrap gap-1">
                  {con.tracking_numbers?.map((tracking) => (
                    <Badge key={tracking} variant="outline" className="font-mono text-xs">
                      <Package className="h-3 w-3 mr-1" />
                      {tracking}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-xl font-bold text-slate-800">${con.total_cost?.toFixed(2)}</p>
            </div>
            {showReadyButton && !con.ready_for_dispatch && (
              <Button
                size="sm"
                onClick={() => handleMarkReady(con)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Listo para Enviar
              </Button>
            )}
            {con.ready_for_dispatch && (
              <Badge className="bg-emerald-600">
                Listo para envío
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Aprobaciones de Despacho</h1>
        <p className="text-slate-500">Gestiona las aprobaciones de envío de clientes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-yellow-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendientes</p>
                <p className="text-3xl font-bold text-slate-800">{pending.length}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Aprobadas</p>
                <p className="text-3xl font-bold text-slate-800">{approved.length}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Listas para Enviar</p>
                <p className="text-3xl font-bold text-slate-800">{readyForDispatch.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Layers className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por tracking, cliente, shipping mark..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="approved" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Aprobadas ({approved.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendientes ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="ready" className="gap-2">
            <Layers className="h-4 w-4" />
            Listas ({readyForDispatch.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approved" className="space-y-4">
          {approved.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin aprobaciones</h3>
                <p className="text-slate-500">No hay consolidaciones aprobadas</p>
              </CardContent>
            </Card>
          ) : (
            approved.map((con) => <ConsolidationCard key={con.id} con={con} showReadyButton />)
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {pending.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-12 text-center">
                <Clock className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin pendientes</h3>
                <p className="text-slate-500">No hay consolidaciones pendientes de aprobación</p>
              </CardContent>
            </Card>
          ) : (
            pending.map((con) => <ConsolidationCard key={con.id} con={con} />)
          )}
        </TabsContent>

        <TabsContent value="ready" className="space-y-4">
          {readyForDispatch.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-12 text-center">
                <Layers className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin envíos listos</h3>
                <p className="text-slate-500">No hay consolidaciones marcadas como listas para enviar</p>
              </CardContent>
            </Card>
          ) : (
            readyForDispatch.map((con) => <ConsolidationCard key={con.id} con={con} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}