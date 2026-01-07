import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Layers, 
  DollarSign, 
  User,
  Loader2,
  Calendar,
  Eye,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { format } from 'date-fns';

export default function ClientDetailsModal({ client, open, onClose, onClientUpdated }) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [consolidations, setConsolidations] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    if (open && client) {
      loadClientData();
    }
  }, [open, client]);

  const loadClientData = async () => {
    setLoading(true);
    const [pkgs, cons] = await Promise.all([
      base44.entities.Package.filter({ client_email: client.email }),
      base44.entities.Consolidation.filter({ client_email: client.email })
    ]);
    setPackages(pkgs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setConsolidations(cons.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setLoading(false);
  };

  if (!client) return null;

  const totalPaid = consolidations
    .filter(c => c.payment_validated)
    .reduce((sum, c) => sum + (c.payment_amount || 0), 0);

  const pendingPayments = consolidations
    .filter(c => c.status === 'pendiente_pago' || c.status === 'pago_pendiente_validacion')
    .reduce((sum, c) => sum + (c.total_cost || 0), 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold">
                {(client.first_name?.[0] || client.email[0]).toUpperCase()}
              </div>
              <div>
                <div className="text-lg">
                  {client.first_name && client.last_name 
                    ? `${client.first_name} ${client.last_name}`
                    : client.email
                  }
                </div>
                <div className="text-sm text-slate-500 font-normal">{client.email}</div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 my-4">
            <Card className="border-0 shadow-sm bg-blue-50">
              <CardContent className="p-4 text-center">
                <Package className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <p className="text-2xl font-bold text-slate-800">{packages.length}</p>
                <p className="text-xs text-slate-600">Paquetes</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-purple-50">
              <CardContent className="p-4 text-center">
                <Layers className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                <p className="text-2xl font-bold text-slate-800">{consolidations.length}</p>
                <p className="text-xs text-slate-600">Consolidaciones</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-emerald-50">
              <CardContent className="p-4 text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
                <p className="text-2xl font-bold text-slate-800">${totalPaid.toFixed(2)}</p>
                <p className="text-xs text-slate-600">Total Pagado</p>
              </CardContent>
            </Card>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <Tabs defaultValue="packages" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="packages">Paquetes</TabsTrigger>
                <TabsTrigger value="consolidations">Consolidaciones</TabsTrigger>
                <TabsTrigger value="payments">Pagos</TabsTrigger>
              </TabsList>

              {/* Packages Tab */}
              <TabsContent value="packages" className="space-y-3 mt-4">
                {packages.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Package className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    <p>No hay paquetes registrados</p>
                  </div>
                ) : (
                  packages.map((pkg) => (
                    <Card key={pkg.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-mono font-medium text-slate-800">{pkg.tracking_number}</p>
                              <StatusBadge status={pkg.status} size="sm" />
                              {pkg.has_insurance && (
                                <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                  Asegurado ${pkg.fob_value}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                              <span className="capitalize">
                                {pkg.shipping_type === 'aereo' ? '✈️ Aéreo' : '🚢 Marítimo'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(pkg.created_date), 'dd/MM/yyyy')}
                              </span>
                            </div>
                            {pkg.description && (
                              <p className="text-sm text-slate-500 mt-1">{pkg.description}</p>
                            )}
                          </div>
                          {pkg.package_image_url && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedImage(pkg.package_image_url)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Consolidations Tab */}
              <TabsContent value="consolidations" className="space-y-3 mt-4">
                {consolidations.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Layers className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    <p>No hay consolidaciones</p>
                  </div>
                ) : (
                  consolidations.map((con) => (
                    <Card key={con.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-mono font-medium text-slate-800">
                                {con.consolidation_tracking}
                              </p>
                              <StatusBadge status={con.status} size="sm" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                              <span>Peso: {con.billable_weight} kg</span>
                              <span>Costo: ${con.total_cost?.toFixed(2)}</span>
                              <span>
                                {con.tracking_numbers?.length || 0} paquetes
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(con.created_date), 'dd/MM/yyyy')}
                              </span>
                            </div>
                            {con.estimated_delivery && (
                              <p className="text-sm text-slate-500 mt-2">
                                Entrega estimada: {format(new Date(con.estimated_delivery), 'dd/MM/yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Payments Tab */}
              <TabsContent value="payments" className="space-y-3 mt-4">
                {consolidations.filter(c => c.payment_date || c.status === 'pendiente_pago').length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                    <p>No hay pagos registrados</p>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <Card className="border-0 shadow-sm bg-slate-50">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-slate-600">Total Pagado</p>
                            <p className="text-2xl font-bold text-emerald-600">${totalPaid.toFixed(2)}</p>
                          </div>
                          {pendingPayments > 0 && (
                            <div className="text-right">
                              <p className="text-sm text-slate-600">Pendiente</p>
                              <p className="text-2xl font-bold text-amber-600">${pendingPayments.toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Payment History */}
                    {consolidations
                      .filter(c => c.payment_date || c.status === 'pendiente_pago')
                      .map((con) => (
                        <Card key={con.id} className="border-0 shadow-sm">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <p className="font-mono text-sm text-slate-800">
                                    {con.consolidation_tracking}
                                  </p>
                                  {con.payment_validated ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Pagado
                                    </Badge>
                                  ) : con.status === 'pago_pendiente_validacion' ? (
                                    <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                                      <Clock className="h-3 w-3 mr-1" />
                                      En validación
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-orange-100 text-orange-700 text-xs">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Pendiente
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-slate-600 space-y-1">
                                  <p>
                                    <span className="font-medium">Monto:</span> ${(con.payment_amount || con.total_cost)?.toFixed(2)}
                                  </p>
                                  {con.payment_method && (
                                    <p className="capitalize">
                                      <span className="font-medium">Método:</span>{' '}
                                      {con.payment_method === 'binance' ? 'Binance' : 'USDT TRC20'}
                                    </p>
                                  )}
                                  {con.payment_date && (
                                    <p>
                                      <span className="font-medium">Fecha:</span>{' '}
                                      {format(new Date(con.payment_date), 'dd/MM/yyyy HH:mm')}
                                    </p>
                                  )}
                                  {con.payment_validated_by && (
                                    <p>
                                      <span className="font-medium">Validado por:</span> {con.payment_validated_by}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {con.payment_proof_url && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedImage(con.payment_proof_url)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <img src={selectedImage} alt="Imagen" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
}