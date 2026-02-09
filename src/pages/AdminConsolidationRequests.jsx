import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  CheckCircle,
  Loader2,
  Eye,
  Plane,
  Ship,
  Calendar,
  User,
  Package as PackageIcon,
  AlertCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import StatusBadge from '@/components/StatusBadge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminConsolidationRequests({ user }) {
  const [requests, setRequests] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pendiente');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const reqs = await base44.entities.ConsolidationRequest.list('-created_date');
    const pkgs = await base44.entities.Package.list();
    setRequests(reqs);
    setPackages(pkgs);
    setLoading(false);
  };

  const getRequestPackages = (request) => {
    if (!request.package_ids) return [];
    return packages.filter(p => request.package_ids.includes(p.id));
  };

  const handleViewDetails = (request) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setApproveLoading(true);

    try {
      await base44.entities.ConsolidationRequest.update(selectedRequest.id, {
        status: 'aprobada',
        approved_by: user.email,
        approved_date: new Date().toISOString()
      });

      // Notify client
      const { sendNotification } = await import('@/components/NotificationUtils');
      sendNotification({
        to: selectedRequest.client_email,
        subject: '✅ Solicitud de consolidación aprobada',
        body: `¡Excelente! Tu solicitud de consolidación ha sido aprobada por el administrador.\n\nPaquetes a consolidar: ${selectedRequest.tracking_numbers?.length || selectedRequest.package_ids?.length || 0}\nTipo de envío: ${selectedRequest.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}\n\nProceeds will begin shortly.`,
        type: 'request',
        icon: 'check',
        referenceId: selectedRequest.id
      });

      toast.success('Solicitud aprobada y cliente notificado');
      setShowDetailsModal(false);
      setShowApproveConfirm(false);
      setSelectedRequest(null);
      loadData();
    } catch (error) {
      toast.error('Error al aprobar solicitud');
    }
    setApproveLoading(false);
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setApproveLoading(true);

    try {
      await base44.entities.ConsolidationRequest.update(selectedRequest.id, {
        status: 'cancelada',
        approved_by: user.email,
        approved_date: new Date().toISOString()
      });

      toast.success('Solicitud rechazada');
      setShowDetailsModal(false);
      setSelectedRequest(null);
      loadData();
    } catch (error) {
      toast.error('Error al rechazar solicitud');
    }
    setApproveLoading(false);
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      (req.client_email || '').toLowerCase().includes(search.toLowerCase()) ||
      (req.shipping_mark || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
        <h1 className="text-2xl font-bold text-slate-800">Solicitudes de Consolidación</h1>
        <p className="text-slate-500">Aprueba manualmente las solicitudes de consolidación de clientes</p>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por email o shipping mark..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full lg:w-auto">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
                <TabsTrigger value="aprobada">Aprobadas</TabsTrigger>
                <TabsTrigger value="consolidada">Consolidadas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left p-4 font-medium text-slate-600">Cliente</th>
                <th className="text-left p-4 font-medium text-slate-600">Shipping Mark</th>
                <th className="text-left p-4 font-medium text-slate-600">Paquetes</th>
                <th className="text-left p-4 font-medium text-slate-600">Tipo</th>
                <th className="text-left p-4 font-medium text-slate-600">Estado</th>
                <th className="text-left p-4 font-medium text-slate-600">Fecha</th>
                <th className="text-left p-4 font-medium text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{req.client_email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-slate-600">{req.shipping_mark || '-'}</td>
                  <td className="p-4">
                    <Badge variant="outline" className="bg-blue-50">
                      {req.package_ids?.length || 0} paquete(s)
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      {req.shipping_type === 'aereo' 
                        ? <><Plane className="h-4 w-4" /> Aéreo</>
                        : <><Ship className="h-4 w-4" /> Marítimo</>
                      }
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge className={
                      req.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                      req.status === 'aprobada' ? 'bg-green-100 text-green-800' :
                      req.status === 'consolidada' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }>
                      {req.status === 'pendiente' ? '⏳ Pendiente' :
                       req.status === 'aprobada' ? '✅ Aprobada' :
                       req.status === 'consolidada' ? '📦 Consolidada' :
                       '❌ Cancelada'}
                    </Badge>
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(req.created_date), 'dd/MM/yyyy', { locale: es })}
                    </div>
                  </td>
                  <td className="p-4">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewDetails(req)}
                      className={req.status === 'pendiente' ? 'border-yellow-300 text-yellow-700' : ''}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRequests.length === 0 && (
          <div className="p-12 text-center">
            <PackageIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No se encontraron solicitudes</p>
          </div>
        )}
      </Card>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={() => { setShowDetailsModal(false); setSelectedRequest(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de Solicitud de Consolidación</DialogTitle>
            <DialogDescription>
              {selectedRequest?.client_email}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6 py-4">
              {/* Request Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500 uppercase">Shipping Mark</p>
                  <p className="font-mono font-medium">{selectedRequest.shipping_mark || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Tipo de Envío</p>
                  <p className="font-medium flex items-center gap-2">
                    {selectedRequest.shipping_type === 'aereo' 
                      ? <><Plane className="h-4 w-4" /> Aéreo</>
                      : <><Ship className="h-4 w-4" /> Marítimo</>
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Estado</p>
                  <Badge className={
                    selectedRequest.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800' :
                    selectedRequest.status === 'aprobada' ? 'bg-green-100 text-green-800' :
                    selectedRequest.status === 'consolidada' ? 'bg-blue-100 text-blue-800' :
                    'bg-red-100 text-red-800'
                  }>
                    {selectedRequest.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Fecha</p>
                  <p className="font-medium">{format(new Date(selectedRequest.created_date), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                </div>
              </div>

              {selectedRequest.notes && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 uppercase font-medium mb-1">Notas del Cliente</p>
                  <p className="text-sm text-slate-700">{selectedRequest.notes}</p>
                </div>
              )}

              {/* Packages */}
              <div>
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <PackageIcon className="h-5 w-5" />
                  Paquetes ({getRequestPackages(selectedRequest).length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {getRequestPackages(selectedRequest).length > 0 ? (
                    getRequestPackages(selectedRequest).map(pkg => (
                      <div key={pkg.id} className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono font-medium text-slate-800">{pkg.tracking_number}</p>
                            <p className="text-xs text-slate-500">{pkg.description}</p>
                          </div>
                          <StatusBadge status={pkg.status} size="sm" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-500">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      No hay paquetes asociados
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedRequest?.status === 'pendiente' && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleReject}
                  disabled={approveLoading}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Rechazar
                </Button>
                <Button 
                  onClick={() => setShowApproveConfirm(true)}
                  disabled={approveLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {approveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Aprobar
                </Button>
              </>
            )}
            {selectedRequest?.status !== 'pendiente' && (
              <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <AlertDialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Aprobación</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de aprobar la solicitud de consolidación para <span className="font-semibold">{selectedRequest?.client_email}</span>.
              <br /><br />
              Se consolidarán <span className="font-semibold">{getRequestPackages(selectedRequest || {}).length} paquete(s)</span> y el cliente será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleApprove();
              }}
              disabled={approveLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aprobando...</>
              ) : (
                <>Confirmar Aprobación</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}