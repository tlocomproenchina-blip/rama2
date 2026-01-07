import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Package, 
  Layers,
  Search,
  Calendar,
  Truck,
  CheckCircle,
  Loader2,
  Archive,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ShippingHistory({ user }) {
  const [packages, setPackages] = useState([]);
  const [consolidations, setConsolidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [expandedItems, setExpandedItems] = useState({});

  useEffect(() => {
    loadHistory();
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    
    const [pkgs, cons] = await Promise.all([
      base44.entities.Package.filter({ client_email: user.email }),
      base44.entities.Consolidation.filter({ client_email: user.email })
    ]);

    // Filter only completed items
    const completedPackages = pkgs.filter(p => p.status === 'entregado');
    const completedConsolidations = cons.filter(c => c.status === 'entregado');

    setPackages(completedPackages);
    setConsolidations(completedConsolidations);
    setLoading(false);
  };

  const toggleExpand = (type, id) => {
    const key = `${type}-${id}`;
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const filterItems = () => {
    const searchLower = search.toLowerCase();

    const filteredPackages = packages.filter(pkg => 
      pkg.tracking_number.toLowerCase().includes(searchLower) ||
      pkg.description?.toLowerCase().includes(searchLower)
    );

    const filteredConsolidations = consolidations.filter(cons =>
      cons.consolidation_tracking.toLowerCase().includes(searchLower) ||
      cons.tracking_numbers?.some(tn => tn.toLowerCase().includes(searchLower))
    );

    return { filteredPackages, filteredConsolidations };
  };

  const { filteredPackages, filteredConsolidations } = filterItems();

  const allItems = [
    ...filteredPackages.map(p => ({ ...p, type: 'package', date: p.updated_date })),
    ...filteredConsolidations.map(c => ({ ...c, type: 'consolidation', date: c.updated_date }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const displayItems = activeTab === 'all' ? allItems :
    activeTab === 'packages' ? filteredPackages.map(p => ({ ...p, type: 'package' })) :
    filteredConsolidations.map(c => ({ ...c, type: 'consolidation' }));

  const stats = {
    totalDelivered: packages.length + consolidations.length,
    totalPackages: packages.length,
    totalConsolidations: consolidations.length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          <Archive className="h-7 w-7 text-blue-600" />
          Historial de Envíos
        </h1>
        <p className="text-slate-500">Consulta todos tus envíos completados</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Entregados</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalDelivered}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Paquetes</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalPackages}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Consolidaciones</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalConsolidations}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Layers className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por número de tracking..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">
                Todos ({allItems.length})
              </TabsTrigger>
              <TabsTrigger value="packages">
                Paquetes ({filteredPackages.length})
              </TabsTrigger>
              <TabsTrigger value="consolidations">
                Consolidaciones ({filteredConsolidations.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* History List */}
      {displayItems.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Archive className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Sin historial
            </h3>
            <p className="text-slate-500">
              {search ? 'No se encontraron resultados' : 'Aún no tienes envíos completados'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {displayItems.map((item) => {
            const isExpanded = expandedItems[`${item.type}-${item.id}`];
            const isPackage = item.type === 'package';

            return (
              <Card key={`${item.type}-${item.id}`} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  {/* Main Info */}
                  <div 
                    className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => toggleExpand(item.type, item.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 rounded-xl ${isPackage ? 'bg-blue-100' : 'bg-purple-100'}`}>
                          {isPackage ? 
                            <Package className="h-6 w-6 text-blue-600" /> :
                            <Layers className="h-6 w-6 text-purple-600" />
                          }
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap mb-2">
                            <h3 className="font-semibold text-slate-800 font-mono">
                              {isPackage ? item.tracking_number : item.consolidation_tracking}
                            </h3>
                            <Badge variant="outline" className="text-xs capitalize">
                              {isPackage ? (item.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo') : 
                              (item.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo')}
                            </Badge>
                            <StatusBadge status="entregado" size="sm" />
                          </div>

                          {isPackage && item.description && (
                            <p className="text-sm text-slate-600 mb-2">{item.description}</p>
                          )}

                          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(item.updated_date), "d 'de' MMMM, yyyy", { locale: es })}
                            </span>
                            {!isPackage && (
                              <span className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {item.tracking_numbers?.length || 0} paquetes
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3 bg-slate-50">
                      {isPackage ? (
                        <>
                          {item.has_insurance && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Seguro:</span>
                              <span className="font-medium text-slate-800">
                                Sí (FOB: ${item.fob_value?.toFixed(2) || '0.00'})
                              </span>
                            </div>
                          )}
                          {item.received_date && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Fecha de recepción:</span>
                              <span className="font-medium text-slate-800">
                                {format(new Date(item.received_date), "d 'de' MMMM, yyyy", { locale: es })}
                              </span>
                            </div>
                          )}
                          {item.shipping_mark && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Shipping Mark:</span>
                              <span className="font-medium text-slate-800 font-mono">{item.shipping_mark}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Costo total:</span>
                            <span className="font-semibold text-emerald-600 text-base">
                              ${item.total_cost?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Costo de envío:</span>
                            <span className="font-medium text-slate-800">
                              ${item.shipping_cost?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                          {item.insurance_cost > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">Seguro:</span>
                              <span className="font-medium text-slate-800">
                                ${item.insurance_cost?.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Peso facturable:</span>
                            <span className="font-medium text-slate-800">
                              {item.billable_weight?.toFixed(2) || '0.00'} kg
                            </span>
                          </div>
                          {item.tracking_numbers && item.tracking_numbers.length > 0 && (
                            <div className="pt-2 border-t border-slate-200">
                              <p className="text-xs text-slate-500 mb-2">Trackings incluidos:</p>
                              <div className="flex flex-wrap gap-2">
                                {item.tracking_numbers.map((tn, idx) => (
                                  <Badge key={idx} variant="outline" className="font-mono text-xs">
                                    {tn}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}