import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mail, Eye, MousePointer, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function EmailHistoryModal({ open, onClose, clientEmail, clientName }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && clientEmail) {
      loadEmailHistory();
    }
  }, [open, clientEmail]);

  const loadEmailHistory = async () => {
    setLoading(true);
    const emailLogs = await base44.entities.EmailLog.filter(
      { recipient_email: clientEmail },
      '-sent_date'
    );
    setLogs(emailLogs);
    setLoading(false);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      sent: { label: 'Enviado', className: 'bg-blue-100 text-blue-800', icon: Mail },
      delivered: { label: 'Entregado', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
      opened: { label: 'Abierto', className: 'bg-purple-100 text-purple-800', icon: Eye },
      clicked: { label: 'Clic', className: 'bg-indigo-100 text-indigo-800', icon: MousePointer },
      bounced: { label: 'Rebotado', className: 'bg-red-100 text-red-800', icon: XCircle },
      failed: { label: 'Fallido', className: 'bg-slate-100 text-slate-800', icon: AlertCircle }
    };

    const config = statusConfig[status] || statusConfig.sent;
    const Icon = config.icon;

    return (
      <Badge className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const stats = {
    total: logs.length,
    delivered: logs.filter(l => ['delivered', 'opened', 'clicked'].includes(l.status)).length,
    opened: logs.filter(l => ['opened', 'clicked'].includes(l.status)).length,
    clicked: logs.filter(l => l.status === 'clicked').length,
    bounced: logs.filter(l => l.status === 'bounced').length
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial de Emails - {clientName || clientEmail}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="border-0 shadow-sm bg-blue-50">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-600">Total</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-green-50">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-600">Entregados</p>
                  <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-purple-50">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-600">Abiertos</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.opened}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-indigo-50">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-600">Clics</p>
                  <p className="text-2xl font-bold text-indigo-600">{stats.clicked}</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-red-50">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-600">Rebotes</p>
                  <p className="text-2xl font-bold text-red-600">{stats.bounced}</p>
                </CardContent>
              </Card>
            </div>

            {/* Email List */}
            <div className="space-y-3">
              {logs.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No hay historial de emails</p>
              ) : (
                logs.map((log) => (
                  <Card key={log.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusBadge(log.status)}
                            {log.source === 'campaign' && (
                              <Badge variant="outline" className="text-xs">
                                Campaña: {log.campaign_name}
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-semibold text-slate-800 mb-1">{log.subject}</h4>
                          {log.body_preview && (
                            <p className="text-sm text-slate-600 mb-2 line-clamp-2">{log.body_preview}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(log.sent_date), 'dd/MM/yyyy HH:mm')}
                            </span>
                            {log.open_count > 0 && (
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {log.open_count} {log.open_count === 1 ? 'apertura' : 'aperturas'}
                              </span>
                            )}
                            {log.click_count > 0 && (
                              <span className="flex items-center gap-1">
                                <MousePointer className="h-3 w-3" />
                                {log.click_count} {log.click_count === 1 ? 'clic' : 'clics'}
                              </span>
                            )}
                            {log.converted && (
                              <span className="text-green-600 font-medium">
                                ✓ Conversión: ${log.conversion_value.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {log.bounce_reason && (
                            <p className="text-xs text-red-600 mt-2">
                              Razón del rebote: {log.bounce_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}