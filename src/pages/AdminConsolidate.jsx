import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Layers, 
  Package, 
  ArrowLeft,
  Plane,
  Ship,
  Loader2,
  CheckCircle,
  User,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminConsolidate({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [clientsWithPackages, setClientsWithPackages] = useState([]);
  const [processing, setProcessing] = useState(null);
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'clients'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load pending requests
    const reqs = await base44.entities.ConsolidationRequest.filter({ 
      status: 'pendiente' 
    }, '-created_date');
    setRequests(reqs);

    // Load packages with pre-alerta or recibido status
    const preAlertPackages = await base44.entities.Package.filter({ 
      status: 'pre_alerta' 
    }, '-created_date');
    
    const receivedPackages = await base44.entities.Package.filter({ 
      status: 'recibido' 
    }, '-created_date');

    const packages = [...preAlertPackages, ...receivedPackages];

    // Group by client email
    const clientMap = {};
    packages.forEach(pkg => {
      if (!clientMap[pkg.client_email]) {
        clientMap[pkg.client_email] = [];
      }
      clientMap[pkg.client_email].push(pkg);
    });

    // Convert to array and sort by count
    const clientsList = Object.entries(clientMap).map(([email, pkgs]) => ({
      email,
      packages: pkgs,
      count: pkgs.length
    })).sort((a, b) => b.count - a.count);

    setClientsWithPackages(clientsList);
    setLoading(false);
  };

  const handleApprove = async (request) => {
    setProcessing(request.id);
    try {
      await base44.entities.ConsolidationRequest.update(request.id, {
        status: 'aprobada',
        approved_by: user.email,
        approved_date: new Date().toISOString()
      });

      // Notify client
      import('@/components/NotificationUtils').then(({ sendNotification }) => {
        sendNotification({
          to: request.client_email,
          subject: '✅ Solicitud de consolidación aprobada',
          body: `Tu solicitud de consolidación ha sido aprobada por el equipo.\n\nShipping Mark: ${request.shipping_mark}\nPaquetes: ${request.tracking_numbers?.length || 0}\n\nEn breve procederemos a consolidar tu carga físicamente.`,
          type: 'general',
          icon: 'check',
          referenceId: request.id
        });
      });

      toast.success('Solicitud aprobada');
      loadData();
    } catch (error) {
      toast.error('Error al aprobar solicitud');
    }
    setProcessing(null);
  };

  const handleReject = async (request) => {
    if (!confirm('¿Estás seguro de cancelar esta solicitud?')) return;

    setProcessing(request.id);
    try {
      await base44.entities.ConsolidationRequest.update(request.id, {
        status: 'cancelada'
      });

      toast.success('Solicitud cancelada');
      loadData();
    } catch (error) {
      toast.error('Error al cancelar solicitud');
    }
    setProcessing(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Aprobar Solicitudes de Consolidación</h1>
        <p className="text-slate-500">Revisa y aprueba las solicitudes de los clientes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'requests'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          Solicitudes ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('clients')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'clients'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-800'
          }`}
        >
          Clientes con Cargas ({clientsWithPackages.length})
        </button>
      </div>

      {/* Stats */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-white">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                {activeTab === 'requests' ? 'Solicitudes Pendientes' : 'Clientes con Paquetes Pendientes'}
              </p>
              <p className="text-3xl font-bold text-slate-800">
                {activeTab === 'requests' ? requests.length : clientsWithPackages.length}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-12 text-center">
                <Layers className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin solicitudes pendientes</h3>
                <p className="text-slate-500">No hay solicitudes de consolidación por aprobar</p>
              </CardContent>
            </Card>
          ) : (
            requests.map((req) => (
              <Card key={req.id} className="border-0 shadow-md hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-3 bg-purple-100 rounded-xl">
                        <Layers className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <User className="h-4 w-4 text-slate-400" />
                            <p className="font-medium text-slate-800">{req.client_email}</p>
                          </div>
                          <Badge variant="outline" className="font-mono">{req.shipping_mark}</Badge>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            {req.shipping_type === 'aereo' 
                              ? <><Plane className="h-4 w-4" /> Aéreo</>
                              : <><Ship className="h-4 w-4" /> Marítimo</>
                            }
                          </div>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            {req.tracking_numbers?.length || 0} paquetes
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {new Date(req.created_date).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>

                        {req.notes && (
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-sm text-slate-600 italic">"{req.notes}"</p>
                          </div>
                        )}

                        <div className="pt-2">
                          <p className="text-xs text-slate-500 mb-2">Trackings solicitados:</p>
                          <div className="flex flex-wrap gap-2">
                            {req.tracking_numbers?.map((tracking) => (
                              <Badge key={tracking} variant="outline" className="font-mono text-xs">
                                {tracking}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => handleApprove(req)}
                        disabled={processing === req.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {processing === req.id ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Aprobando...</>
                        ) : (
                          <><CheckCircle className="h-4 w-4 mr-2" /> Aprobar</>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleReject(req)}
                        disabled={processing === req.id}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div className="space-y-4">
          {clientsWithPackages.length === 0 ? (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-12 text-center">
                <Package className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin cargas pendientes</h3>
                <p className="text-slate-500">No hay paquetes en pre-alerta</p>
              </CardContent>
            </Card>
          ) : (
            clientsWithPackages.map((client) => (
              <Card key={client.email} className="border-0 shadow-md hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 rounded-xl">
                          <User className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{client.email}</p>
                          <Badge className="mt-1 bg-blue-100 text-blue-700">
                            {client.count} paquete{client.count !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {client.packages.map((pkg) => (
                        <div key={pkg.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-3 flex-1">
                            <Package className="h-4 w-4 text-slate-400" />
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-sm font-medium text-slate-800">{pkg.tracking_number}</p>
                              <p className="text-xs text-slate-500">{pkg.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {pkg.shipping_type === 'aereo' 
                              ? <Plane className="h-4 w-4 text-slate-400" />
                              : <Ship className="h-4 w-4 text-slate-400" />
                            }
                            {pkg.has_insurance && (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-xs">
                                Asegurado
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}