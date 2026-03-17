import React, { useEffect, useState } from 'react';
import { format, parse } from 'date-fns';
import { CheckCircle2, Loader2, MapPin, Package, Save, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import TrackingStatsCard from '@/components/shipment-tracking/TrackingStatsCard';
import TrackingFilters from '@/components/shipment-tracking/TrackingFilters';
import TrackingShipmentCard from '@/components/shipment-tracking/TrackingShipmentCard';

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
    const [cons, invoices] = await Promise.all([
      base44.entities.Consolidation.list('-created_date'),
      base44.entities.Invoice.list('-created_date')
    ]);

    const invoicedConsolidationIds = new Set(
      (invoices || []).map((invoice) => invoice.consolidation_id).filter(Boolean)
    );

    const filtered = cons.filter((item) => {
      const belongsToUser = user?.role === 'admin' || item.client_email === user?.email;
      return belongsToUser && invoicedConsolidationIds.has(item.id);
    });

    setConsolidations(filtered);
    setLoading(false);
  };

  const handleStatusChange = async (consolidation, newStatus) => {
    try {
      await base44.entities.Consolidation.update(consolidation.id, { status: newStatus });

      for (const pkgId of consolidation.package_ids || []) {
        await base44.entities.Package.update(pkgId, { status: newStatus });
      }

      if (['disponible', 'entregado'].includes(newStatus)) {
        const { notifyConsolidationStatus } = await import('@/components/NotificationUtils');
        notifyConsolidationStatus(consolidation, newStatus);
      }

      toast.success('Estado actualizado correctamente');
      loadData();
    } catch {
      toast.error('Error al actualizar el estado');
    }
  };

  const handleEditDate = (consolidation) => {
    setEditingDate(consolidation);
    try {
      setShippingDate(consolidation.shipping_date ? format(new Date(consolidation.shipping_date), 'yyyy-MM-ddTHH:mm') : '');
      setEstimatedDate(consolidation.estimated_delivery || '');
    } catch {
      setShippingDate('');
      setEstimatedDate('');
    }
  };

  const handleSaveDate = async () => {
    if (!shippingDate && !estimatedDate) {
      toast.error('Selecciona al menos una fecha');
      return;
    }

    try {
      setSavingDate(true);
      const updateData = {};
      if (shippingDate) updateData.shipping_date = shippingDate;
      if (estimatedDate) updateData.estimated_delivery = estimatedDate;

      await base44.entities.Consolidation.update(editingDate.id, updateData);

      if (estimatedDate) {
        const { sendNotification } = await import('@/components/NotificationUtils');
        sendNotification({
          to: editingDate.client_email,
          subject: '📅 Fecha de entrega actualizada',
          body: `La fecha de entrega estimada de tu consolidación ${editingDate.consolidation_tracking} ha sido actualizada.\n\nNueva fecha estimada: ${format(parse(estimatedDate, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}\n\nIngresa al sistema para más detalles.`,
          type: 'consolidation',
          icon: 'alert',
          referenceId: editingDate.id,
        });
      }

      toast.success('Fechas actualizadas correctamente');
      setEditingDate(null);
      setShippingDate('');
      setEstimatedDate('');
      loadData();
    } catch {
      toast.error('Error al actualizar fechas');
    }
    setSavingDate(false);
  };

  const handleExportApprovals = () => {
    const grouped = {};

    consolidations.forEach((con) => {
      const mark = con.shipping_mark || 'SIN MARK';
      if (!grouped[mark]) grouped[mark] = [];
      grouped[mark].push(con.consolidation_tracking);
    });

    let text = '';
    Object.entries(grouped).forEach(([mark, trackings]) => {
      text += `${mark}\n`;
      trackings.forEach((tracking) => {
        text += `${tracking}\n`;
      });
    });

    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
    element.setAttribute('download', `aprobaciones-${new Date().toISOString().split('T')[0]}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Aprobaciones exportadas');
  };

  const filteredCons = consolidations.filter((con) => {
    const term = search.toLowerCase();
    const matchesSearch =
      con.consolidation_tracking?.toLowerCase().includes(term) ||
      con.client_email?.toLowerCase().includes(term) ||
      con.shipping_mark?.toLowerCase().includes(term);

    const matchesStatus = filterStatus === 'all' || con.status === filterStatus;
    const matchesType = filterType === 'all' || con.shipping_type === filterType;

    return matchesSearch && matchesStatus && matchesType;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Seguimiento de Envíos</h1>
        <p className="text-slate-500">Rastrea tus consolidaciones en tiempo real</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TrackingStatsCard label="Total" value={consolidations.length} icon={Package} tone="blue" />
        <TrackingStatsCard label="En Tránsito" value={consolidations.filter((item) => item.status === 'en_transito').length} icon={Truck} tone="indigo" />
        <TrackingStatsCard label="Disponible" value={consolidations.filter((item) => item.status === 'disponible').length} icon={MapPin} tone="emerald" />
        <TrackingStatsCard label="Entregado" value={consolidations.filter((item) => item.status === 'entregado').length} icon={CheckCircle2} tone="green" />
      </div>

      <TrackingFilters
        search={search}
        onSearchChange={setSearch}
        filterStatus={filterStatus}
        onStatusChange={setFilterStatus}
        filterType={filterType}
        onTypeChange={setFilterType}
        showExport={user?.role === 'admin' && consolidations.length > 0}
        onExport={handleExportApprovals}
      />

      {filteredCons.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Package className="mx-auto mb-4 h-16 w-16 text-slate-300" />
            <h3 className="mb-2 text-lg font-semibold text-slate-700">Sin consolidaciones</h3>
            <p className="text-slate-500">No se encontraron consolidaciones con esos filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCons.map((consolidation) => (
            <TrackingShipmentCard
              key={consolidation.id}
              consolidation={consolidation}
              user={user}
              onStatusChange={handleStatusChange}
              onEditDate={handleEditDate}
              onDataChanged={loadData}
            />
          ))}
        </div>
      )}

      <Dialog open={!!editingDate} onOpenChange={() => setEditingDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Fechas de Consolidación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Consolidación</Label>
              <p className="rounded bg-slate-50 p-2 font-mono text-sm text-slate-600">
                {editingDate?.consolidation_tracking}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Fecha de Salida</Label>
              <Input type="datetime-local" value={shippingDate} onChange={(e) => setShippingDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de Entrega Estimada</Label>
              <Input type="date" value={estimatedDate} onChange={(e) => setEstimatedDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDate(null)}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSaveDate} disabled={savingDate} className="bg-blue-600 hover:bg-blue-700">
              {savingDate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}