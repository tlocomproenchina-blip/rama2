import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  CreditCard, 
  Search, 
  CheckCircle,
  Loader2,
  DollarSign,
  Clock
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PaymentValidation from '@/components/admin/PaymentValidation';

export default function AdminPayments({ user }) {
  const [consolidations, setConsolidations] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const pageSize = 30;
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (append = false) => {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      const skip = append ? consolidations.length : 0;
      const cons = await base44.entities.Consolidation.list('-created_date', pageSize, skip);
      setConsolidations((prev) => append ? [...prev, ...cons] : cons);
      setHasMore(cons.length === pageSize);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  };

  const handleStatusChange = async (con, newStatus) => {
    await base44.entities.Consolidation.update(con.id, { status: newStatus });

    // Update packages
    for (const pkgId of (con.package_ids || [])) {
      await base44.entities.Package.update(pkgId, { status: newStatus });
    }

    // Notify client based on status
    const statusMessages = {
      'en_transito': { 
        emoji: '🚚', 
        title: 'En Tránsito', 
        body: 'Tu carga está en camino hacia su destino.',
        shortMsg: 'Tu carga está en camino.'
      },
      'disponible': { 
        emoji: '📍', 
        title: 'Disponible para Retiro', 
        body: 'Tu carga ha llegado y está lista para ser retirada. Por favor contáctanos para coordinar la entrega.',
        shortMsg: 'Tu carga está lista para retiro.'
      },
      'entregado': { 
        emoji: '✅', 
        title: 'Entregado', 
        body: '¡Tu carga ha sido entregada exitosamente! Nos encantaría conocer tu opinión sobre nuestro servicio.',
        shortMsg: '¡Tu carga ha sido entregada!',
        feedbackLink: true
      }
    };

    if (statusMessages[newStatus]) {
      const msg = statusMessages[newStatus];
      
      // Build email body
      let emailBody = `${msg.body}\n\nTracking: ${con.consolidation_tracking}\nShipping Mark: ${con.shipping_mark || 'N/A'}`;
      
      // Add feedback link for delivered status
      if (msg.feedbackLink) {
        const feedbackUrl = `${window.location.origin}/feedback?tracking=${con.consolidation_tracking}`;
        emailBody += `\n\n📝 Déjanos tu opinión:\n${feedbackUrl}`;
      }

      // Send email
      base44.integrations.Core.SendEmail({
        to: con.client_email,
        subject: `${msg.emoji} ${msg.title} - ${con.consolidation_tracking}`,
        body: emailBody
      }).catch(err => console.error('Email error:', err));

      // Create in-app notification
      base44.entities.Notification.create({
        user_email: con.client_email,
        title: `${msg.emoji} ${msg.title}`,
        message: `${con.consolidation_tracking}: ${msg.shortMsg}`,
        type: 'consolidation',
        icon: newStatus === 'entregado' ? 'check' : 'truck',
        reference_id: con.id
      }).catch(err => console.error('Notification error:', err));
    }

    toast.success('Estado actualizado y cliente notificado');
    loadData();
  };

  useEffect(() => {
    if (statusFilter !== 'pending' || clients.length > 0) return;
    base44.entities.User.list('-created_date', 300).then(setClients).catch(() => {});
  }, [statusFilter, clients.length]);

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
      {/* Nota: Stripe está disponible para clientes en Mis Facturas; admin puede habilitar/deshabilitar métodos en Admin Invoices → Métodos de Pago */}
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
      {statusFilter === 'pending' ? (
        <PaymentValidation 
          consolidations={filteredCons}
          clients={clients}
          onRefresh={loadData}
          currentUser={user}
        />
      ) : filteredCons.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <CreditCard className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin consolidaciones</h3>
            <p className="text-slate-500">No se encontraron consolidaciones</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCons.map((con) => (
            <Card key={con.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-4 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
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
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Total</p>
                      <p className="text-lg font-bold text-slate-800">${con.total_cost?.toFixed(2)}</p>
                    </div>
                    <StatusBadge status={con.status} />
                    
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

      {hasMore && (
        <Button variant="outline" className="w-full" onClick={() => loadData(true)} disabled={loadingMore}>
          {loadingMore ? 'Cargando...' : 'Cargar más'}
        </Button>
      )}
    </div>
  );
}