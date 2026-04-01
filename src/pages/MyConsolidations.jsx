import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Layers, 
  Package, 
  Plane, 
  Ship,
  Calendar,
  DollarSign,
  CreditCard,
  Loader2,
  ChevronDown,
  ChevronUp,
  Weight,
  Ruler,
  RefreshCw,
  CheckCircle2,
  Clock
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import PaymentModal from '@/components/PaymentModal';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ListSkeletonLoader } from '@/components/SkeletonLoaders';
import { toast } from 'sonner';
import { format, parse } from 'date-fns';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import PortalMetricCard from '@/components/client-portal/PortalMetricCard';
import ClientSectionHeader from '@/components/client-portal/ClientSectionHeader';

export default function MyConsolidations({ user }) {
  const [consolidations, setConsolidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [config, setConfig] = useState(null);
  const PAGE_SIZE = 100;
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    setLoading(true);
    Promise.all([
      base44.entities.Consolidation.filter({ client_email: user.email }, '-created_date', PAGE_SIZE, 0),
      base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1)
    ]).then(([cons, cfgs]) => {
      setConsolidations(cons || []);
      setHasMore((cons || []).length === PAGE_SIZE);
      setConfig(cfgs?.[0] || null);
    }).catch((error) => {
      console.error('Error loading consolidations:', error);
      toast.error('No se pudieron cargar las consolidaciones.');
      setConsolidations([]);
      setHasMore(false);
    }).finally(() => {
      setLoading(false);
    });
  }, [user?.email]);

  const loadConsolidations = async (append = false) => {
    if (!user) return;
    const skip = append ? consolidations.length : 0;
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const cons = await base44.entities.Consolidation.filter({ client_email: user.email }, '-created_date', PAGE_SIZE, skip);
      if (append) {
        setConsolidations(prev => [...prev, ...cons]);
      } else {
        setConsolidations(cons);
      }
      setHasMore(cons.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading consolidations:', error);
      toast.error('No se pudieron cargar las consolidaciones.');
      if (!append) {
        setConsolidations([]);
        setHasMore(false);
      }
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  };

  const canPay = (con) => {
    return con.status === 'pendiente_pago';
  };

  const isPending = (con) => {
    return con.status === 'pago_pendiente_validacion';
  };

  const hasActivePaymentMethods = React.useMemo(() => {
    const c = config;
    if (!c) return false;
    // Considera solo métodos distintos a Stripe
    return (
      (c.payments_enable_binance === true && c.wallet_binance) ||
      (c.payments_enable_usdt_trc20 === true && c.wallet_usdt_trc20) ||
      (c.payments_enable_paypal === true && c.wallet_paypal) ||
      (c.payments_enable_wally === true && c.wallet_wally) ||
      (c.payments_enable_zinli === true && c.wallet_zinli) ||
      (c.payments_enable_wise === true && c.wallet_wise) ||
      (c.payments_enable_skrill === true && c.wallet_skrill) ||
      (c.payments_enable_pago_movil_usdt === true && c.wallet_pago_movil_usdt)
    );
  }, [config]);

  const canApproveShipment = (con) => {
    return con.payment_validated && !con.shipment_approved && con.status !== 'en_transito' && con.status !== 'disponible' && con.status !== 'entregado';
  };

  const handleApproveShipment = async (con) => {
    try {
      await base44.entities.Consolidation.update(con.id, {
        shipment_approved: true,
        shipment_approved_date: new Date().toISOString()
      });
      await loadConsolidations();
    } catch (error) {
      console.error('Error al aprobar despacho:', error);
    }
  };

  const consolidationStats = React.useMemo(() => ({
    total: consolidations.length,
    pending: consolidations.filter((con) => con.status === 'pendiente_pago').length,
    transit: consolidations.filter((con) => con.status === 'en_transito').length,
    available: consolidations.filter((con) => con.status === 'disponible').length,
  }), [consolidations]);

  const handleRefresh = async () => {
    const now = Date.now();
    const timeSinceLastRefresh = (now - lastRefreshTime) / 1000;

    if (timeSinceLastRefresh < 60) {
      const remainingTime = Math.ceil(60 - timeSinceLastRefresh);
      toast.error(`Espera ${remainingTime}s antes de actualizar nuevamente`);
      return;
    }

    setRefreshing(true);
    setLastRefreshTime(now);
    await loadConsolidations();
    setRefreshing(false);
    toast.success('Consolidaciones actualizadas');
  };

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-5 lg:space-y-6 w-full">
        <div className="h-8 bg-slate-200 rounded w-32 animate-pulse" />
        <ListSkeletonLoader count={3} />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5 lg:space-y-6 w-full">
      <ClientPageHero
        icon={Layers}
        eyebrow="Gestión de envíos"
        title="Mis Consolidaciones"
        description="Revisa tus paquetes consolidados, estados y pagos en una vista más clara y ejecutiva."
        badges={[`${consolidations.length} consolidaciones`, hasActivePaymentMethods ? 'Pagos activos' : 'Sin pagos manuales']}
        action={
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
            {refreshing ? (
              <><Loader2 className="h-3 w-3 md:h-4 mr-2 animate-spin" /> Actualizando...</>
            ) : (
              <><RefreshCw className="h-3 w-3 md:h-4 mr-2" /> Actualizar</>
            )}
          </Button>
        }
        aside={
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Estado rápido</p>
            <div className="rounded-2xl bg-slate-100/90 px-3 py-2 text-sm font-semibold text-slate-700">
              {consolidationStats.pending} pendiente(s) de pago
            </div>
            <p className="text-sm text-muted-foreground">Usa actualizar solo cuando necesites una verificación manual del estado.</p>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PortalMetricCard title="Total" value={consolidationStats.total} subtitle="Consolidaciones registradas" icon={Layers} tone="blue" />
        <PortalMetricCard title="Pendiente pago" value={consolidationStats.pending} subtitle="Esperando acción" icon={CreditCard} tone="amber" />
        <PortalMetricCard title="En tránsito" value={consolidationStats.transit} subtitle="Cargas activas" icon={Ship} tone="violet" />
        <PortalMetricCard title="Disponibles" value={consolidationStats.available} subtitle="Listas para entrega" icon={CheckCircle2} tone="blue" />
      </div>

      {/* Consolidations List */}
      {consolidations.length === 0 ? (
        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardContent className="p-6 md:p-12 text-center">
            <Layers className="h-12 md:h-16 w-12 md:w-16 mx-auto mb-3 md:mb-4 text-slate-300" />
            <h3 className="text-base md:text-lg font-semibold text-slate-700 mb-2">Sin consolidaciones</h3>
            <p className="text-xs md:text-sm text-slate-500">
              Aún no tienes paquetes consolidados. Cuando tus paquetes sean consolidados, aparecerán aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
                <>
                <ClientSectionHeader
                  title="Listado de consolidaciones"
                  description="Expande cada consolidación para revisar costos, paquetes incluidos y acciones disponibles."
                />
                <div className="space-y-3 md:space-y-4">
                  {consolidations.map((con) => (
                    <Card key={con.id} className="border border-border/70 bg-card/95 shadow-card overflow-hidden transition-all duration-200 hover:shadow-premium">
                      <Collapsible open={expandedId === con.id} onOpenChange={() => setExpandedId(expandedId === con.id ? null : con.id)}>
                        <CollapsibleTrigger asChild>
                  <CardHeader className="p-3 md:p-4 lg:p-6 cursor-pointer hover:bg-slate-50/80 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                      {/* Main Info */}
                      <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                        <div className="p-2.5 md:p-3 bg-purple-100 rounded-lg md:rounded-xl flex-shrink-0">
                          <Layers className="h-5 w-5 md:h-6 text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-800 font-mono text-xs md:text-base lg:text-lg truncate">
                            {con.consolidation_tracking}
                          </h3>
                          <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-slate-500 mt-1 flex-wrap">
                            {con.shipping_type === 'aereo' 
                              ? <><Plane className="h-3 w-3 md:h-4 flex-shrink-0" /> <span>Aéreo</span></>
                              : <><Ship className="h-3 w-3 md:h-4 flex-shrink-0" /> <span>Marítimo</span></>
                            }
                            <span>•</span>
                            <span>{con.tracking_numbers?.length || 0} paquetes</span>
                          </div>
                        </div>
                      </div>

                      {/* Status & Total */}
                      <div className="flex items-center gap-2 md:gap-4 justify-between md:justify-end">
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs md:text-sm text-slate-500">Total</p>
                          <p className="text-base md:text-xl font-bold text-slate-800">${con.total_cost?.toFixed(2)}</p>
                        </div>
                        <StatusBadge status={con.status} />
                        {expandedId === con.id ? <ChevronUp className="h-4 w-4 md:h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 md:h-5 text-slate-400 flex-shrink-0" />}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="p-3 md:p-4 lg:p-6 pt-3 md:pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-3 md:mt-4">
                      {/* Details */}
                      <div className="space-y-3 md:space-y-4">
                        <h4 className="font-semibold text-slate-700 text-sm md:text-base">Detalles del Envío</h4>
                        <div className="grid grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm">
                          <div className="flex items-start gap-2 min-w-0">
                            <Weight className="h-3 w-3 md:h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-500 flex-shrink-0">Peso Real:</span>
                            <span className="font-medium truncate">{con.real_weight_kg} kg</span>
                          </div>
                          <div className="flex items-start gap-2 min-w-0">
                            <Weight className="h-3 w-3 md:h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-500 flex-shrink-0">Peso Vol.:</span>
                            <span className="font-medium truncate">{con.volumetric_weight?.toFixed(2)} kg</span>
                          </div>
                          <div className="flex items-start gap-2 min-w-0">
                            <Ruler className="h-3 w-3 md:h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-500 flex-shrink-0">CBM:</span>
                            <span className="font-medium truncate">{con.cbm?.toFixed(4)} m³</span>
                          </div>
                          <div className="flex items-start gap-2 min-w-0 col-span-2">
                            <Ruler className="h-3 w-3 md:h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-500 flex-shrink-0">Dimensiones:</span>
                            <span className="font-medium truncate">{con.length_cm}×{con.width_cm}×{con.height_cm} cm</span>
                          </div>
                          <div className="flex items-start gap-2 min-w-0 col-span-2">
                            <Calendar className="h-3 w-3 md:h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-500 flex-shrink-0">Entrega Est.:</span>
                            <span className="font-medium truncate">
                              {con.estimated_delivery ? format(parse(con.estimated_delivery, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : 'Pendiente'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Costs */}
                      <div className="space-y-3 md:space-y-4">
                        <h4 className="font-semibold text-slate-700 text-sm md:text-base">Costos</h4>
                        <div className="bg-slate-50 rounded-lg md:rounded-xl p-3 md:p-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Costo de envío:</span>
                            <span className="font-medium">${con.shipping_cost?.toFixed(2)}</span>
                          </div>
                          {con.insurance_cost > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Seguro:</span>
                              <span className="font-medium">${con.insurance_cost?.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                            <span>Total:</span>
                            <span className="text-emerald-600">${con.total_cost?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tracking Numbers */}
                    <div className="mt-4 md:mt-6">
                      <h4 className="font-semibold text-slate-700 mb-2 md:mb-3 text-sm md:text-base">Paquetes Incluidos</h4>
                      <div className="flex flex-wrap gap-2">
                        {con.tracking_numbers?.map((tracking) => (
                          <Badge key={tracking} variant="outline" className="font-mono">
                            <Package className="h-3 w-3 mr-1" />
                            {tracking}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Payment & Approval Section */}
                    <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t border-slate-100 space-y-3">
                      {canPay(con) && hasActivePaymentMethods && (
                        <Button 
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => setPaymentModal(con)}
                          size="sm"
                        >
                          <CreditCard className="h-3 w-3 md:h-4 mr-2" />
                          Pagar Consolidación
                        </Button>
                      )}
                      {isPending(con) && (
                        <div className="flex items-start gap-3 p-3 md:p-4 bg-yellow-50 rounded-lg md:rounded-xl border border-yellow-200">
                          <Loader2 className="h-4 w-4 md:h-5 animate-spin text-yellow-600 flex-shrink-0 mt-1" />
                          <div className="min-w-0">
                            <p className="font-medium text-yellow-800 text-sm md:text-base">Pago reportado, en espera de validación</p>
                            <p className="text-xs md:text-sm text-yellow-700">Te notificaremos cuando sea verificado</p>
                          </div>
                        </div>
                      )}
                      {canApproveShipment(con) && (
                        <div className="p-3 md:p-4 bg-blue-50 rounded-lg md:rounded-xl border border-blue-200">
                          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                            <div className="min-w-0">
                              <p className="font-medium text-blue-800 text-sm md:text-base">Tu consolidación está lista para despacho</p>
                              <p className="text-xs md:text-sm text-blue-700">Aprueba el envío desde China</p>
                            </div>
                            <Button
                              onClick={() => handleApproveShipment(con)}
                              className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
                              size="sm"
                            >
                              <CheckCircle2 className="h-3 w-3 md:h-4 mr-2" />
                              Aprobar Despacho
                            </Button>
                          </div>
                        </div>
                      )}
                      {con.shipment_approved && (
                        <div className="flex items-start gap-3 p-3 md:p-4 bg-green-50 rounded-lg md:rounded-xl border border-green-200">
                          <CheckCircle2 className="h-4 w-4 md:h-5 text-green-600 flex-shrink-0 mt-1" />
                          <div className="min-w-0">
                            <p className="font-medium text-green-800 text-sm md:text-base">Despacho aprobado</p>
                            <p className="text-xs md:text-sm text-green-700 truncate">
                              Aprobado el {new Date(con.shipment_approved_date).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
        {hasMore && (
          <Button variant="outline" className="w-full mt-2" onClick={() => loadConsolidations(true)} disabled={loadingMore}>
            {loadingMore ? 'Cargando...' : 'Cargar más'}
          </Button>
        )}
        </>
        )}

        {/* Payment Modal */}
      {paymentModal && (
        <PaymentModal
          open={!!paymentModal}
          onClose={() => setPaymentModal(null)}
          consolidation={paymentModal}
          onPaymentSubmitted={loadConsolidations}
        />
      )}
    </div>
  );
}