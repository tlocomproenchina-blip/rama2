import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { sendTemplateEmail } from '@/components/utils/emailTemplates';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  CreditCard, 
  Search, 
  CheckCircle,
  XCircle,
  Eye,
  Loader2,
  DollarSign,
  Clock,
  Wallet
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPayments({ user }) {
  const [consolidations, setConsolidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedCon, setSelectedCon] = useState(null);
  const [viewProof, setViewProof] = useState(null);
  const [rejectComment, setRejectComment] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadConsolidations();
  }, []);

  const loadConsolidations = async () => {
    const cons = await base44.entities.Consolidation.list('-created_date');
    setConsolidations(cons);
    setLoading(false);
  };

  const handleValidate = async () => {
    if (!selectedCon) return;
    setProcessing(true);

    try {
      await base44.entities.Consolidation.update(selectedCon.id, {
        payment_validated: true,
        payment_validated_by: user.email,
        payment_validation_date: new Date().toISOString(),
        status: 'en_transito'
      });

      // Update package statuses
      for (const pkgId of (selectedCon.package_ids || [])) {
        await base44.entities.Package.update(pkgId, { status: 'en_transito' });
      }

      toast.success('Pago validado exitosamente');

      // Notify client (async)
      sendTemplateEmail('payment_validated', selectedCon.client_email, {
        consolidation_tracking: selectedCon.consolidation_tracking,
        payment_amount: selectedCon.payment_amount?.toFixed(2),
        total_cost: selectedCon.total_cost?.toFixed(2)
      }).catch(err => console.error('Email error:', err));

      setSelectedCon(null);
      loadConsolidations();
    } catch (error) {
      toast.error('Error al validar');
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedCon) return;
    setProcessing(true);

    try {
      await base44.entities.Consolidation.update(selectedCon.id, {
        payment_validated: false,
        payment_rejection_comment: rejectComment,
        status: 'pendiente_pago'
      });

      toast.success('Pago rechazado');

      // Notify client (async)
      sendTemplateEmail('payment_rejected', selectedCon.client_email, {
        consolidation_tracking: selectedCon.consolidation_tracking,
        total_cost: selectedCon.total_cost?.toFixed(2),
        rejection_reason: rejectComment || 'El comprobante de pago proporcionado no es válido o no coincide con el monto.'
      }).catch(err => console.error('Email error:', err));

      setSelectedCon(null);
      setRejectComment('');
      loadConsolidations();
    } catch (error) {
      toast.error('Error al rechazar');
    }
    setProcessing(false);
  };

  const handleStatusChange = async (con, newStatus) => {
    await base44.entities.Consolidation.update(con.id, { status: newStatus });

    // Update packages
    for (const pkgId of (con.package_ids || [])) {
      await base44.entities.Package.update(pkgId, { status: newStatus });
    }

    toast.success('Estado actualizado');

    // Notify client based on status (async)
    const statusTemplates = {
      'en_transito': 'consolidation_in_transit',
      'disponible': 'consolidation_available',
      'entregado': 'consolidation_delivered'
    };

    if (statusTemplates[newStatus]) {
      sendTemplateEmail(statusTemplates[newStatus], con.client_email, {
        consolidation_tracking: con.consolidation_tracking
      }).catch(err => console.error('Email error:', err));
    }

    loadConsolidations();
  };

  const filteredCons = consolidations.filter(con => {
    const matchesSearch = 
      con.consolidation_tracking?.toLowerCase().includes(search.toLowerCase()) ||
      con.client_email?.toLowerCase().includes(search.toLowerCase()) ||
      con.shipping_mark?.toLowerCase().includes(search.toLowerCase());
    
    if (statusFilter === 'pending') {
      return matchesSearch && con.status === 'pago_pendiente_validacion';
    } else if (statusFilter === 'validated') {
      return matchesSearch && con.payment_validated;
    }
    return matchesSearch;
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
        <h1 className="text-2xl font-bold text-slate-800">Validación de Pagos</h1>
        <p className="text-slate-500">Revisa y valida los pagos de las consolidaciones</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-yellow-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendientes</p>
                <p className="text-3xl font-bold text-slate-800">
                  {consolidations.filter(c => c.status === 'pago_pendiente_validacion').length}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Validados</p>
                <p className="text-3xl font-bold text-slate-800">
                  {consolidations.filter(c => c.payment_validated).length}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Recaudado</p>
                <p className="text-3xl font-bold text-slate-800">
                  ${consolidations.filter(c => c.payment_validated).reduce((sum, c) => sum + (c.payment_amount || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <DollarSign className="h-6 w-6 text-blue-600" />
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
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="pending">Pendientes</TabsTrigger>
                <TabsTrigger value="validated">Validados</TabsTrigger>
                <TabsTrigger value="all">Todos</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Consolidations List */}
      {filteredCons.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <CreditCard className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin pagos pendientes</h3>
            <p className="text-slate-500">No hay pagos que requieran validación</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCons.map((con) => (
            <Card key={con.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-4 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <CreditCard className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-mono font-medium text-slate-800">{con.consolidation_tracking}</h3>
                        <p className="text-sm text-slate-500">{con.client_email}</p>
                      </div>
                    </div>
                    {con.payment_method && (
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-2">
                        <Wallet className="h-4 w-4" />
                        {con.payment_method === 'binance' ? 'Binance' : 'USDT TRC20'}
                        <span className="mx-2">•</span>
                        ${con.payment_amount?.toFixed(2)} pagado
                      </div>
                    )}
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Total</p>
                      <p className="text-lg font-bold text-slate-800">${con.total_cost?.toFixed(2)}</p>
                    </div>
                    <StatusBadge status={con.status} />
                    
                    {con.status === 'pago_pendiente_validacion' && (
                      <div className="flex gap-2">
                        {con.payment_proof_url && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setViewProof(con.payment_proof_url)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => setSelectedCon(con)}
                        >
                          Revisar
                        </Button>
                      </div>
                    )}

                    {con.payment_validated && (
                      <select
                        value={con.status}
                        onChange={(e) => handleStatusChange(con, e.target.value)}
                        className="text-sm border rounded-lg px-3 py-2"
                      >
                        <option value="en_transito">En Tránsito</option>
                        <option value="disponible">Disponible</option>
                        <option value="entregado">Entregado</option>
                      </select>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Validation Modal */}
      <Dialog open={!!selectedCon} onOpenChange={() => setSelectedCon(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Validar Pago</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">Tracking</p>
                <p className="font-mono font-medium">{selectedCon?.consolidation_tracking}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">Cliente</p>
                <p className="font-medium truncate">{selectedCon?.client_email}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">Total a pagar</p>
                <p className="font-bold text-lg">${selectedCon?.total_cost?.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">Monto reportado</p>
                <p className="font-bold text-lg text-emerald-600">${selectedCon?.payment_amount?.toFixed(2)}</p>
              </div>
            </div>

            {selectedCon?.payment_proof_url && (
              <div className="space-y-2">
                <Label>Comprobante de Pago</Label>
                <img 
                  src={selectedCon.payment_proof_url} 
                  alt="Comprobante" 
                  className="w-full rounded-lg border cursor-pointer hover:opacity-90"
                  onClick={() => setViewProof(selectedCon.payment_proof_url)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Comentario de rechazo (opcional)</Label>
              <Textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Motivo del rechazo si aplica..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleReject}
              disabled={processing}
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rechazar
            </Button>
            <Button 
              onClick={handleValidate}
              disabled={processing}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Validar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Proof Modal */}
      <Dialog open={!!viewProof} onOpenChange={() => setViewProof(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprobante de Pago</DialogTitle>
          </DialogHeader>
          <img src={viewProof} alt="Comprobante" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </div>
  );
}