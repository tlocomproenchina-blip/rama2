import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
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
  RefreshCw
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import PaymentModal from '@/components/PaymentModal';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function MyConsolidations({ user }) {
  const [consolidations, setConsolidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadConsolidations();
  }, [user]);

  const loadConsolidations = async () => {
    if (!user) return;
    const cons = await base44.entities.Consolidation.filter({ client_email: user.email }, '-created_date');
    setConsolidations(cons);
    setLoading(false);
  };

  const canPay = (con) => {
    return con.status === 'pendiente_pago';
  };

  const isPending = (con) => {
    return con.status === 'pago_pendiente_validacion';
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
        <h1 className="text-2xl font-bold text-slate-800">Mis Consolidaciones</h1>
        <p className="text-slate-500">Revisa tus paquetes consolidados y realiza pagos</p>
      </div>

      {/* Consolidations List */}
      {consolidations.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Layers className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin consolidaciones</h3>
            <p className="text-slate-500">
              Aún no tienes paquetes consolidados. Cuando tus paquetes sean consolidados, aparecerán aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {consolidations.map((con) => (
            <Card key={con.id} className="border-0 shadow-lg overflow-hidden">
              <Collapsible open={expandedId === con.id} onOpenChange={() => setExpandedId(expandedId === con.id ? null : con.id)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="p-4 lg:p-6 cursor-pointer hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Main Info */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className="p-3 bg-purple-100 rounded-xl">
                          <Layers className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800 font-mono text-lg">
                            {con.consolidation_tracking}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                            {con.shipping_type === 'aereo' 
                              ? <><Plane className="h-4 w-4" /> Aéreo</>
                              : <><Ship className="h-4 w-4" /> Marítimo</>
                            }
                            <span>•</span>
                            <span>{con.tracking_numbers?.length || 0} paquetes</span>
                          </div>
                        </div>
                      </div>

                      {/* Status & Total */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-slate-500">Total</p>
                          <p className="text-xl font-bold text-slate-800">${con.total_cost?.toFixed(2)}</p>
                        </div>
                        <StatusBadge status={con.status} />
                        {expandedId === con.id ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="p-4 lg:p-6 pt-0 border-t border-slate-100">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                      {/* Details */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700">Detalles del Envío</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Weight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-500">Peso Real:</span>
                            <span className="font-medium">{con.real_weight_kg} kg</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Weight className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-500">Peso Vol.:</span>
                            <span className="font-medium">{con.volumetric_weight?.toFixed(2)} kg</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Ruler className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-500">CBM:</span>
                            <span className="font-medium">{con.cbm?.toFixed(4)} m³</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Ruler className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-500">Dimensiones:</span>
                            <span className="font-medium">{con.length_cm}×{con.width_cm}×{con.height_cm} cm</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-500">Entrega Est.:</span>
                            <span className="font-medium">
                              {con.estimated_delivery ? new Date(con.estimated_delivery).toLocaleDateString('es-ES') : 'Pendiente'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Costs */}
                      <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700">Costos</h4>
                        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
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
                    <div className="mt-6">
                      <h4 className="font-semibold text-slate-700 mb-3">Paquetes Incluidos</h4>
                      <div className="flex flex-wrap gap-2">
                        {con.tracking_numbers?.map((tracking) => (
                          <Badge key={tracking} variant="outline" className="font-mono">
                            <Package className="h-3 w-3 mr-1" />
                            {tracking}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Payment Section */}
                    <div className="mt-6 pt-4 border-t border-slate-100">
                      {canPay(con) && (
                        <Button 
                          className="w-full lg:w-auto bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => setPaymentModal(con)}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Pagar Consolidación
                        </Button>
                      )}
                      {isPending(con) && (
                        <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                          <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
                          <div>
                            <p className="font-medium text-yellow-800">Pago reportado, en espera de validación</p>
                            <p className="text-sm text-yellow-700">Te notificaremos cuando sea verificado</p>
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