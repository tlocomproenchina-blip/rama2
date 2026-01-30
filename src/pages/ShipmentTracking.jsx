import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Loader2, 
  Ship, 
  Plane, 
  Package,
  Clock,
  CheckCircle2,
  Truck,
  Calendar,
  Search,
  Filter,
  ArrowRight,
  Edit2,
  Save,
  X,
  Download
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

export default function ShipmentTracking({ user }) {
  const [consolidations, setConsolidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [editingDate, setEditingDate] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [savingDate, setSavingDate] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    const query = user?.role === 'admin' 
      ? {} 
      : { client_email: user.email };
    
    const cons = await base44.entities.Consolidation.list('-created_date');
    const filtered = cons.filter(c => {
      if (user?.role === 'admin') return true;
      return c.client_email === user.email;
    });
    
    setConsolidations(filtered);
    setLoading(false);
  };

  const handleStatusChange = async (consolidation, newStatus) => {
    try {
      await base44.entities.Consolidation.update(consolidation.id, {
        status: newStatus
      });

      // Update packages status
      for (const pkgId of (consolidation.package_ids || [])) {
        await base44.entities.Package.update(pkgId, { status: newStatus });
      }

      // Notify client
      if (['disponible', 'entregado'].includes(newStatus)) {
        const { notifyConsolidationStatus } = await import('@/components/NotificationUtils');
        notifyConsolidationStatus(consolidation, newStatus);
      }

      toast.success('Estado actualizado correctamente');
      loadData();
    } catch (error) {
      toast.error('Error al actualizar el estado');
    }
  };

  const handleEditDate = (consolidation) => {
    setEditingDate(consolidation);
    setNewDate(consolidation.estimated_delivery ? format(new Date(consolidation.estimated_delivery), 'yyyy-MM-dd') : '');
  };

  const handleSaveDate = async () => {
    if (!newDate) {
      toast.error('Selecciona una fecha');
      return;
    }

    setSavingDate(true);
    try {
      await base44.entities.Consolidation.update(editingDate.id, {
        estimated_delivery: newDate
      });

      // Notify client
      const { sendNotification } = await import('@/components/NotificationUtils');
      sendNotification({
        to: editingDate.client_email,
        subject: '📅 Fecha de entrega actualizada',
        body: `La fecha de entrega estimada de tu consolidación ${editingDate.consolidation_tracking} ha sido actualizada.\n\nNueva fecha estimada: ${format(new Date(newDate), 'dd/MM/yyyy')}\n\nIngresa al sistema para más detalles.`,
        type: 'consolidation',
        icon: 'alert',
        referenceId: editingDate.id
      });

      toast.success('Fecha actualizada');
      setEditingDate(null);
      loadData();
    } catch (error) {
      toast.error('Error al actualizar fecha');
    }
    setSavingDate(false);
  };

  const getColorClasses = (color) => {
    const colorMap = {
      emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
      blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
      amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
      teal: { bg: 'bg-teal-100', text: 'text-teal-600' },
      green: { bg: 'bg-green-100', text: 'text-green-600' }
    };
    return colorMap[color] || { bg: 'bg-slate-100', text: 'text-slate-400' };
  };

  const getStatusSteps = (consolidation) => {
    const steps = [
      { 
        key: 'created', 
        label: 'Consolidación Creada', 
        icon: Package,
        completed: true,
        date: consolidation.created_date,
        color: 'emerald'
      },
      { 
        key: 'transit', 
        label: 'En Tránsito', 
        icon: consolidation.shipping_type === 'aereo' ? Plane : Ship,
        completed: ['en_transito', 'pago_validado', 'disponible', 'entregado'].includes(consolidation.status),
        date: consolidation.created_date,
        color: 'blue'
      },
      { 
        key: 'payment', 
        label: 'Pago Validado', 
        icon: CheckCircle2,
        completed: ['pago_validado', 'disponible', 'entregado'].includes(consolidation.status) || consolidation.payment_validated,
        date: consolidation.payment_validation_date,
        color: 'amber'
      },
      { 
        key: 'available', 
        label: 'Disponible para Retiro', 
        icon: MapPin,
        completed: ['disponible', 'entregado'].includes(consolidation.status),
        date: consolidation.status === 'disponible' ? consolidation.updated_date : null,
        color: 'teal'
      },
      { 
        key: 'delivered', 
        label: 'Entregado', 
        icon: CheckCircle2,
        completed: consolidation.status === 'entregado',
        date: consolidation.status === 'entregado' ? consolidation.updated_date : null,
        color: 'green'
      }
    ];
    return steps;
  };

  const getProgress = (con) => {
    const steps = getStatusSteps(con);
    const completed = steps.filter(s => s.completed).length;
    return (completed / steps.length) * 100;
  };

  const getDaysInTransit = (con) => {
    if (!con.created_date) return 0;
    return differenceInDays(new Date(), new Date(con.created_date));
  };

  const getEstimatedDaysRemaining = (con) => {
    if (con.estimated_delivery) {
      const remaining = differenceInDays(new Date(con.estimated_delivery), new Date());
      return Math.max(0, remaining);
    }
    return null;
  };

  const handleExportApprovals = () => {
    // Group by shipping_mark and get tracking numbers
    const grouped = {};
    
    consolidations.forEach(con => {
      const mark = con.shipping_mark || 'SIN MARK';
      if (!grouped[mark]) {
        grouped[mark] = [];
      }
      grouped[mark].push(con.consolidation_tracking);
    });

    // Format as requested
    let text = '';
    Object.entries(grouped).forEach(([mark, trackings]) => {
      text += mark + '\n';
      trackings.forEach(tracking => {
        text += tracking + '\n';
      });
    });

    // Download as text file
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', `aprobaciones-${new Date().toISOString().split('T')[0]}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Aprobaciones exportadas');
  };

  const filteredCons = consolidations.filter(con => {
    const matchesSearch = 
      con.consolidation_tracking?.toLowerCase().includes(search.toLowerCase()) ||
      con.client_email?.toLowerCase().includes(search.toLowerCase()) ||
      con.shipping_mark?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || con.status === filterStatus;
    const matchesType = filterType === 'all' || con.shipping_type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
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
        <h1 className="text-2xl font-bold text-slate-800">Seguimiento de Envíos</h1>
        <p className="text-slate-500">Rastrea tus consolidaciones en tiempo real</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-3xl font-bold text-slate-800">{consolidations.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">En Tránsito</p>
                <p className="text-3xl font-bold text-slate-800">
                  {consolidations.filter(c => c.status === 'en_transito').length}
                </p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Truck className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Disponible</p>
                <p className="text-3xl font-bold text-slate-800">
                  {consolidations.filter(c => c.status === 'disponible').length}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <MapPin className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Entregado</p>
                <p className="text-3xl font-bold text-slate-800">
                  {consolidations.filter(c => c.status === 'entregado').length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por tracking, email o shipping mark..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={filterStatus} onValueChange={setFilterStatus}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="en_transito">En Tránsito</TabsTrigger>
                <TabsTrigger value="disponible">Disponible</TabsTrigger>
                <TabsTrigger value="entregado">Entregado</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={filterType} onValueChange={setFilterType}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="aereo">Aéreo</TabsTrigger>
                <TabsTrigger value="maritimo">Marítimo</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Shipments List */}
      {filteredCons.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin consolidaciones</h3>
            <p className="text-slate-500">No se encontraron consolidaciones</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredCons.map((con) => {
            const steps = getStatusSteps(con);
            const progress = getProgress(con);
            const daysInTransit = getDaysInTransit(con);
            const daysRemaining = getEstimatedDaysRemaining(con);
            
            return (
              <motion.div
                key={con.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg font-mono">
                          {con.consolidation_tracking}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-500">
                          {user?.role === 'admin' && (
                            <>
                              <span>{con.client_email}</span>
                              <span>•</span>
                            </>
                          )}
                          <Badge variant="outline">
                            {con.shipping_type === 'aereo' ? (
                              <><Plane className="h-3 w-3 mr-1" /> Aéreo</>
                            ) : (
                              <><Ship className="h-3 w-3 mr-1" /> Marítimo</>
                            )}
                          </Badge>
                          {con.shipping_mark && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              {con.shipping_mark}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-start lg:items-end gap-2">
                        <div className="text-sm text-slate-500 flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {daysInTransit} días desde creación
                        </div>
                        {daysRemaining !== null && (
                          <div className="text-sm text-emerald-600 flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            ~{daysRemaining} días restantes
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-slate-700">Progreso</span>
                        <span className="text-sm font-bold text-blue-600">{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      </div>
                    </div>

                    {/* Route Map */}
                    <div className="relative bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-6">
                      <div className="flex items-center justify-between relative">
                        {/* Origin */}
                        <div className="flex flex-col items-center z-10">
                          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white mb-2">
                            <Package className="h-6 w-6" />
                          </div>
                          <p className="text-sm font-medium text-slate-800">Origen</p>
                          <p className="text-xs text-slate-500">China</p>
                        </div>

                        {/* Route Line */}
                        <div className="absolute inset-0 flex items-center px-12">
                          <div className="flex-1 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 relative">
                            {con.shipping_type === 'aereo' ? (
                              <motion.div
                                className="absolute top-1/2 -translate-y-1/2"
                                initial={{ left: '0%' }}
                                animate={{ left: `${progress}%` }}
                                transition={{ duration: 2 }}
                              >
                                <Plane className="h-6 w-6 text-indigo-600" />
                              </motion.div>
                            ) : (
                              <motion.div
                                className="absolute top-1/2 -translate-y-1/2"
                                initial={{ left: '0%' }}
                                animate={{ left: `${progress}%` }}
                                transition={{ duration: 2 }}
                              >
                                <Ship className="h-6 w-6 text-indigo-600" />
                              </motion.div>
                            )}
                          </div>
                        </div>

                        {/* Destination */}
                        <div className="flex flex-col items-center z-10">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white mb-2 ${
                            con.status === 'entregado' ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}>
                            <MapPin className="h-6 w-6" />
                          </div>
                          <p className="text-sm font-medium text-slate-800">Destino</p>
                          <p className="text-xs text-slate-500">Venezuela</p>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-3">
                      {steps.map((step, idx) => {
                        const Icon = step.icon;
                        return (
                          <motion.div
                            key={step.key}
                            className="flex items-start gap-4"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              step.completed 
                                ? `${getColorClasses(step.color).bg} ${getColorClasses(step.color).text}` 
                                : 'bg-slate-100 text-slate-400'
                            }`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 pt-1">
                              <p className={`font-medium ${
                                step.completed ? 'text-slate-800' : 'text-slate-400'
                              }`}>
                                {step.label}
                              </p>
                              {step.date && (
                                <p className="text-xs text-slate-500 mt-1">
                                  {format(new Date(step.date), 'dd/MM/yyyy HH:mm')}
                                </p>
                              )}
                            </div>
                            {step.completed && (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-2" />
                            )}
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Shipment Details */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-xs text-slate-500">Peso Facturable</p>
                        <p className="font-semibold text-slate-800">{con.billable_weight || '-'} kg</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Costo Total</p>
                        <p className="font-semibold text-slate-800">${con.total_cost?.toFixed(2) || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Paquetes</p>
                        <p className="font-semibold text-slate-800">{con.package_ids?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Entrega Estimada</p>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-800">
                            {con.estimated_delivery 
                              ? format(new Date(con.estimated_delivery), 'dd/MM/yyyy')
                              : '-'
                            }
                          </p>
                          {user?.role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditDate(con)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Admin Status Control */}
                    {user?.role === 'admin' && con.status === 'en_transito' && (
                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-lg">
                          <Edit2 className="h-5 w-5 text-blue-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800 mb-1">Cambiar Estado</p>
                            <Select onValueChange={(value) => handleStatusChange(con, value)}>
                              <SelectTrigger className="w-full lg:w-64 bg-white">
                                <SelectValue placeholder="Seleccionar nuevo estado..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="disponible">
                                  📦 Disponible para Retiro
                                </SelectItem>
                                <SelectItem value="entregado">
                                  ✅ Entregado
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit Date Modal */}
      <Dialog open={!!editingDate} onOpenChange={() => setEditingDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Fecha de Entrega Estimada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Consolidación</Label>
              <p className="text-sm font-mono text-slate-600 bg-slate-50 p-2 rounded">
                {editingDate?.consolidation_tracking}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nueva Fecha de Entrega Estimada</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDate(null)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSaveDate} disabled={savingDate} className="bg-blue-600 hover:bg-blue-700">
              {savingDate ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}