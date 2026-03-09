import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, 
  Loader2, 
  DollarSign,
  Calendar,
  Mail,
  Bell,
  Clock,
  User,
  RefreshCw
} from 'lucide-react';
import { differenceInDays, format } from 'date-fns';
import { toast } from 'sonner';

export default function AdminPaymentAlerts({ user }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertDays, setAlertDays] = useState(7);
  const [notifying, setNotifying] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
    // Debounce initial data load slightly to avoid burst on navigation
    const t = setTimeout(() => loadData(), 150);
    return () => clearTimeout(t);
  }, []);

  const loadConfig = async () => {
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0 && configs[0].payment_alert_days) {
        setAlertDays(configs[0].payment_alert_days);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const handleAlertDaysChange = async (newDays) => {
    const daysValue = parseInt(newDays) || 7;
    setAlertDays(daysValue);
    setSaving(true);
    
    try {
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) {
        await base44.entities.AppConfig.update(configs[0].id, {
          payment_alert_days: daysValue
        });
        toast.success('Configuración guardada');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error al guardar la configuración');
    }
    setSaving(false);
  };

  const loadData = async () => {
    setLoading(true);
    // Use queued client with dedupe keys and lower priority reads
    const [cons, invoices] = await Promise.all([
      base44.entities.Consolidation.filter({ status: 'pendiente_pago' }, '-updated_date', 200),
      base44.entities.Invoice.filter({ status: 'pendiente' }, '-updated_date', 200)
    ]);

    // Get consolidation IDs that have invoices
    const consolidationIdsWithInvoices = new Set(invoices.map(inv => inv.consolidation_id).filter(Boolean));
    
    // Only include consolidations that don't have an invoice
    const filteredCons = cons.filter(c => !consolidationIdsWithInvoices.has(c.id));

    // Combinar consolidations (sin factura) e invoices en un único array
    const allPayments = [
      ...filteredCons.map(c => ({ ...c, type: 'consolidation', payment_id: c.id })),
      ...invoices.map(inv => ({ ...inv, type: 'invoice', payment_id: inv.id }))
    ].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

    setPayments(allPayments);
    setLoading(false);
  };

  const getDaysOverdue = (consolidation) => {
    return differenceInDays(new Date(), new Date(consolidation.created_date));
  };

  const notifyClient = async (payment) => {
    setNotifying({ ...notifying, [payment.payment_id]: true });
    
    try {
      const daysOverdue = getDaysOverdue(payment);
      const subject = payment.type === 'invoice' ? 'Factura' : 'Consolidación';
      const reference = payment.type === 'invoice' ? payment.invoice_number : payment.consolidation_tracking;
      const amount = payment.type === 'invoice' ? payment.total : payment.total_cost;
      
      // Send email
      await base44.integrations.Core.SendEmail({
        to: payment.client_email,
        subject: '⏰ Recordatorio de Pago Pendiente',
        body: `Tienes un pago pendiente para tu ${subject.toLowerCase()}:\n\nReferencia: ${reference}\nMonto: $${amount?.toFixed(2)}\nDías pendientes: ${daysOverdue}\n\nPor favor realiza el pago lo antes posible.\n\nIngresa al sistema para ver los detalles y realizar el pago.`
      });

      // In-app notification
      await base44.entities.Notification.create({
        user_email: payment.client_email,
        title: '⏰ Recordatorio de Pago',
        message: `Pago pendiente de $${amount?.toFixed(2)} - ${daysOverdue} días`,
        type: 'payment',
        icon: 'dollar',
        reference_id: payment.payment_id
      });

      toast.success(`Recordatorio enviado a ${payment.client_email}`);
    } catch (error) {
      toast.error('Error al enviar recordatorio');
    }
    
    setNotifying({ ...notifying, [payment.payment_id]: false });
  };

  const notifyAllOverdue = async () => {
    const overdue = payments.filter(p => getDaysOverdue(p) >= alertDays);
    
    if (overdue.length === 0) {
      toast.info('No hay pagos pendientes para notificar');
      return;
    }

    const confirmed = window.confirm(`¿Enviar recordatorio a ${overdue.length} cliente(s) con pagos pendientes de ${alertDays}+ días?`);
    if (!confirmed) return;

    setLoading(true);
    for (const payment of overdue) {
      await notifyClient(payment);
    }
    setLoading(false);
    toast.success(`${overdue.length} recordatorio(s) enviado(s)`);
  };

  const overduePayments = payments.filter(p => getDaysOverdue(p) >= alertDays);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alertas de Pago</h1>
          <p className="text-slate-500">Pagos pendientes y recordatorios automáticos</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pagos Pendientes</p>
                <p className="text-3xl font-bold text-slate-800">{payments.length}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <DollarSign className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Vencidos ({alertDays}+ días)</p>
                <p className="text-3xl font-bold text-slate-800">{overduePayments.length}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Pendiente</p>
                <p className="text-2xl font-bold text-slate-800">
                  ${payments.reduce((sum, p) => sum + (p.type === 'invoice' ? (p.total || 0) : (p.total_cost || 0)), 0).toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <DollarSign className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Configuration */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Configuración de Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label>Días para considerar vencido</Label>
              <Input
                type="number"
                min="1"
                value={alertDays}
                onChange={(e) => handleAlertDaysChange(e.target.value)}
                disabled={saving}
                className="mt-1"
              />
            </div>
            <Button 
              onClick={notifyAllOverdue}
              disabled={overduePayments.length === 0}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Mail className="h-4 w-4 mr-2" />
              Enviar Recordatorios ({overduePayments.length})
            </Button>
          </div>
          <p className="text-sm text-slate-500">
            Los clientes con pagos pendientes de {alertDays} días o más recibirán un recordatorio por email y notificación.
          </p>
        </CardContent>
      </Card>

      {/* Overdue Payments List */}
      {overduePayments.length > 0 && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Pagos Vencidos ({overduePayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overduePayments.map((payment) => {
              const daysOverdue = getDaysOverdue(payment);
              const reference = payment.type === 'invoice' ? payment.invoice_number : payment.consolidation_tracking;
              const amount = payment.type === 'invoice' ? payment.total : payment.total_cost;
              const typeLabel = payment.type === 'invoice' ? '📄 Factura' : '📦 Consolidación';
              
              return (
                <div 
                  key={payment.payment_id}
                  className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 p-4 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-semibold text-red-600">{typeLabel}</span>
                      <span className="font-mono font-medium text-slate-800">
                        {reference}
                      </span>
                      <Badge className="bg-red-100 text-red-700 border-red-200">
                        <Clock className="h-3 w-3 mr-1" />
                        {daysOverdue} días
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {payment.client_email}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        ${amount?.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Creado: {format(new Date(payment.created_date), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => notifyClient(payment)}
                    disabled={notifying[payment.payment_id]}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {notifying[payment.payment_id] ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2" />
                    )}
                    Enviar Recordatorio
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* All Pending Payments */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Todos los Pagos Pendientes ({payments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {payments.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <DollarSign className="h-12 w-12 mx-auto mb-2 text-slate-300" />
              <p>No hay pagos pendientes</p>
            </div>
          ) : (
            payments.map((payment) => {
              const daysOverdue = getDaysOverdue(payment);
              const isOverdue = daysOverdue >= alertDays;
              const reference = payment.type === 'invoice' ? payment.invoice_number : payment.consolidation_tracking;
              const amount = payment.type === 'invoice' ? payment.total : payment.total_cost;
              const typeLabel = payment.type === 'invoice' ? '📄 Factura' : '📦 Consolidación';
              
              return (
                <div 
                  key={payment.payment_id}
                  className={`flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 p-4 rounded-lg border ${
                    isOverdue 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-semibold text-slate-600">{typeLabel}</span>
                      <span className="font-mono font-medium text-slate-800">
                        {reference}
                      </span>
                      {isOverdue && (
                        <Badge className="bg-red-100 text-red-700 border-red-200">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Vencido
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {payment.client_email}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        ${amount?.toFixed(2)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {daysOverdue} día(s) pendiente(s)
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(payment.created_date), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  </div>
                  {isOverdue && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => notifyClient(payment)}
                      disabled={notifying[payment.payment_id]}
                    >
                      {notifying[payment.payment_id] ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Recordar
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}