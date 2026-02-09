import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Clock, Calendar, Plane, Ship, Package, MapPin, CheckCircle2, Edit2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TrackingCard({ consolidation, user, onStatusChange, onEditDate, getStatusSteps, getProgress, getDaysInTransit, getEstimatedDaysRemaining, getColorClasses }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const steps = getStatusSteps(consolidation);
  const progress = getProgress(consolidation);
  const daysInTransit = getDaysInTransit(consolidation);
  const daysRemaining = getEstimatedDaysRemaining(consolidation);

  const statusColors = {
    en_transito: 'bg-blue-100 text-blue-700',
    pago_validado: 'bg-amber-100 text-amber-700',
    disponible: 'bg-emerald-100 text-emerald-700',
    entregado: 'bg-green-100 text-green-700'
  };

  const getStatusLabel = (status) => {
    const labels = {
      en_transito: '✈️ En Tránsito',
      pago_validado: '💳 Pago Validado',
      disponible: '📍 Disponible',
      entregado: '✅ Entregado'
    };
    return labels[status] || status;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
        {/* Compact Header - Always Visible */}
        <motion.div
          className="cursor-pointer bg-gradient-to-r from-slate-50 to-white p-4 lg:p-6 border-b hover:from-slate-100"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between gap-4 mb-3">
            {/* Left Side */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm lg:text-base font-mono font-bold text-slate-800 truncate">
                  {consolidation.consolidation_tracking}
                </span>
                <Badge className={statusColors[consolidation.status]}>
                  {getStatusLabel(consolidation.status)}
                </Badge>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 text-xs lg:text-sm text-slate-600">
                {user?.role === 'admin' && (
                  <>
                    <span>{consolidation.client_email}</span>
                    <span>•</span>
                  </>
                )}
                <Badge variant="outline" className="flex items-center gap-1">
                  {consolidation.shipping_type === 'aereo' ? (
                    <><Plane className="h-3 w-3" /> Aéreo</>
                  ) : (
                    <><Ship className="h-3 w-3" /> Marítimo</>
                  )}
                </Badge>
                {consolidation.shipping_mark && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    {consolidation.shipping_mark}
                  </Badge>
                )}
              </div>
            </div>

            {/* Right Side - Quick Stats */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-slate-500">Tránsito / Estimado</p>
                  <p className="text-sm lg:text-base font-bold text-slate-800">
                    {daysInTransit}d / {daysRemaining !== null ? daysRemaining + 'd' : '-'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <ChevronDown className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* Progress Bar with Label */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-slate-600">Progreso</span>
              <span className="text-xs font-bold text-blue-600">{Math.round(progress)}%</span>
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
        </motion.div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CardContent className="space-y-6 p-4 lg:p-6 border-t">
                {/* Time Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Tiempo en Tránsito</p>
                    <p className="flex items-center gap-2 font-semibold text-slate-800">
                      <Clock className="h-4 w-4" />
                      {daysInTransit} días
                    </p>
                  </div>
                  {daysRemaining !== null && (
                    <div className={`p-3 rounded-lg ${daysRemaining < 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                      <p className="text-xs text-slate-500 mb-1">Días Restantes</p>
                      <p className={`flex items-center gap-2 font-semibold ${daysRemaining < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        <Calendar className="h-4 w-4" />
                        {daysRemaining < 0 ? `${Math.abs(daysRemaining)} atrasado` : `${daysRemaining}`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Etapas de Envío</p>
                  {steps.map((step, idx) => {
                    const Icon = step.icon;
                    return (
                      <motion.div
                        key={step.key}
                        className="flex items-start gap-3"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          step.completed 
                            ? `${getColorClasses(step.color).bg} ${getColorClasses(step.color).text}` 
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 pt-0.5">
                          <p className={`text-sm font-medium ${
                            step.completed ? 'text-slate-800' : 'text-slate-400'
                          }`}>
                            {step.label}
                          </p>
                          {step.date && (
                             <p className="text-xs text-slate-500">
                               {(() => {
                                 try {
                                   const date = new Date(step.date);
                                   if (isNaN(date.getTime())) return '-';
                                   return format(date, 'dd/MM/yyyy HH:mm');
                                 } catch (e) {
                                   return '-';
                                 }
                               })()}
                             </p>
                           )}
                        </div>
                        {step.completed && <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Route Visualization */}
                <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white mx-auto mb-2">
                        <Package className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-medium">Origen</p>
                      <p className="text-xs text-slate-500">China</p>
                    </div>
                    <div className="flex-1 mx-3 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full" />
                    <div className="text-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white mx-auto mb-2 ${
                        consolidation.status === 'entregado' ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}>
                        <MapPin className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-medium">Destino</p>
                      <p className="text-xs text-slate-500">Venezuela</p>
                    </div>
                  </div>
                </div>

                {/* Shipment Details */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Peso Facturable</p>
                    <p className="font-semibold text-slate-800">{consolidation.billable_weight || '-'} kg</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Costo Total</p>
                    <p className="font-semibold text-slate-800">${consolidation.total_cost?.toFixed(2) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Paquetes</p>
                    <p className="font-semibold text-slate-800">{consolidation.package_ids?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Fecha Salida</p>
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-slate-800">
                          {consolidation.shipping_date 
                            ? (() => {
                                try {
                                  const date = new Date(consolidation.shipping_date);
                                  if (isNaN(date.getTime())) return '-';
                                  return format(date, 'dd/MM');
                                } catch (e) {
                                  return '-';
                                }
                              })()
                            : '-'
                          }
                        </p>
                      {user?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditDate(consolidation)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Entrega Estimada</p>
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-slate-800">
                        {consolidation.estimated_delivery 
                          ? format(new Date(consolidation.estimated_delivery), 'dd/MM')
                          : '-'
                        }
                      </p>
                      {user?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditDate(consolidation)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Admin Status Control */}
                {user?.role === 'admin' && consolidation.status === 'en_transito' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-900 mb-3">Cambiar Estado</p>
                    <Select onValueChange={(value) => onStatusChange(consolidation, value)}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Seleccionar nuevo estado..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disponible">📦 Disponible para Retiro</SelectItem>
                        <SelectItem value="entregado">✅ Entregado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}