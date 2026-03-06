import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
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
  Edit2,
  Save,
  X,
  Download
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, differenceInDays, parse } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import TrackingCard from '@/components/tracking/TrackingCard';

export default function ShipmentTracking({ user }) {
  const [consolidations, setConsolidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [editingDate, setEditingDate] = useState(null);
  const [shippingDate, setShippingDate] = useState('');
  const [estimatedDate, setEstimatedDate] = useState('');
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
    try {
      setShippingDate(consolidation.shipping_date ? format(new Date(consolidation.shipping_date), 'yyyy-MM-ddTHH:mm') : '');
      setEstimatedDate(consolidation.estimated_delivery || '');
    } catch (e) {
      setShippingDate('');
      setEstimatedDate('');
    }
  };

  const handleSaveDate = async () => {
    if (!shippingDate && !estimatedDate) {
      toast.error('Selecciona al menos una fecha');
      return;
    }

    setSavingDate(true);
    try {
      const updateData = {};
      if (shippingDate) updateData.shipping_date = shippingDate;
      if (estimatedDate) updateData.estimated_delivery = estimatedDate;

      await base44.entities.Consolidation.update(editingDate.id, updateData);

      // Notify client if estimated delivery changed
      if (estimatedDate) {
        const { sendNotification } = await import('@/components/NotificationUtils');
        sendNotification({
          to: editingDate.client_email,
          subject: '📅 Fecha de entrega actualizada',
          body: `La fecha de entrega estimada de tu consolidación ${editingDate.consolidation_tracking} ha sido actualizada.\n\nNueva fecha estimada: ${format(parse(estimatedDate, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}\n\nIngresa al sistema para más detalles.`,
          type: 'consolidation',
          icon: 'alert',
          referenceId: editingDate.id
        });
      }

      toast.success('Fechas actualizadas correctamente');
      setEditingDate(null);
      setShippingDate('');
      setEstimatedDate('');
      loadData();
    } catch (error) {
      toast.error('Error al actualizar fechas');
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
    // Calculate progress based on estimated delivery date (treat estimated_delivery as local date)
    if (!con.created_date || !con.estimated_delivery) {
      const steps = getStatusSteps(con);
      const completed = steps.filter(s => s.completed).length;
      return (completed / steps.length) * 100;
    }

    try {
      const createdDate = new Date(con.created_date);
      const estimatedDeliveryDate = typeof con.estimated_delivery === 'string'
        ? parse(con.estimated_delivery, 'yyyy-MM-dd', new Date())
        : new Date(con.estimated_delivery);

      if (isNaN(createdDate.getTime()) || isNaN(estimatedDeliveryDate.getTime())) {
        const steps = getStatusSteps(con);
        const completed = steps.filter(s => s.completed).length;
        return (completed / steps.length) * 100;
      }

      const currentDate = new Date();
      const totalDays = differenceInDays(estimatedDeliveryDate, createdDate);
      const elapsedDays = differenceInDays(currentDate, createdDate);

      if (totalDays <= 0) return 100;
      const progress = (elapsedDays / totalDays) * 100;
      return Math.min(100, Math.max(0, progress));
    } catch (e) {
      const steps = getStatusSteps(con);
      const completed = steps.filter(s => s.completed).length;
      return (completed / steps.length) * 100;
    }
  };

  const getDaysInTransit = (con) => {
    // Días estimados de tránsito según tipo de envío
    return con.shipping_type === 'maritimo' ? 90 : 30;
  };

  const getEstimatedDaysRemaining = (con) => {
    if (con.estimated_delivery) {
      try {
        const estimatedDate = new Date(con.estimated_delivery);
        if (isNaN(estimatedDate.getTime())) return null;
        
        // Calcular días restantes hasta la fecha estimada
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deliveryDate = new Date(estimatedDate);
        deliveryDate.setHours(0, 0, 0, 0);
        
        const remaining = differenceInDays(deliveryDate, today);
        return remaining >= 0 ? remaining : remaining; // Mostrar negativo si está retrasado
      } catch (e) {
        return null;
      }
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
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por tracking, email o shipping mark..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', 'en_transito', 'disponible', 'entregado'].map(status => (
                <Button
                  key={status}
                  variant={filterStatus === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                >
                  {status === 'all' ? 'Todos' : status === 'en_transito' ? 'En Tránsito' : status === 'disponible' ? 'Disponible' : 'Entregado'}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', 'aereo', 'maritimo'].map(type => (
                <Button
                  key={type}
                  variant={filterType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(type)}
                >
                  {type === 'all' ? 'Todos' : type === 'aereo' ? 'Aéreo' : 'Marítimo'}
                </Button>
              ))}
            </div>
            {user?.role === 'admin' && consolidations.length > 0 && (
              <Button
                onClick={handleExportApprovals}
                className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            )}
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
        <div className="space-y-3">
          {filteredCons.map((con) => (
            <TrackingCard
              key={con.id}
              consolidation={con}
              user={user}
              onStatusChange={handleStatusChange}
              onEditDate={handleEditDate}
              getStatusSteps={getStatusSteps}
              getProgress={getProgress}
              getDaysInTransit={getDaysInTransit}
              getEstimatedDaysRemaining={getEstimatedDaysRemaining}
              getColorClasses={getColorClasses}
              onDataChanged={loadData}
            />
          ))}
        </div>
      )}

      {/* Edit Date Modal */}
      <Dialog open={!!editingDate} onOpenChange={() => setEditingDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Fechas de Consolidación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Consolidación</Label>
              <p className="text-sm font-mono text-slate-600 bg-slate-50 p-2 rounded">
                {editingDate?.consolidation_tracking}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Fecha de Salida</Label>
              <Input
                type="datetime-local"
                value={shippingDate}
                onChange={(e) => setShippingDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha de Entrega Estimada</Label>
              <Input
                type="date"
                value={estimatedDate}
                onChange={(e) => setEstimatedDate(e.target.value)}
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