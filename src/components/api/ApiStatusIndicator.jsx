import React, { useState, useEffect } from 'react';
import { getApiStatus, resetCircuitBreaker } from './ApiQueueManager';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, Shield, RefreshCw } from 'lucide-react';

/**
 * Indicador de estado del sistema API
 * Muestra circuit breaker, cola, y errores
 */
export default function ApiStatusIndicator() {
  const [status, setStatus] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      const currentStatus = getApiStatus();
      setStatus(currentStatus);
      
      // Solo mostrar si hay problemas relevantes en alta carga
      setShow(
        currentStatus.circuitBreakerState === 'OPEN' ||
        currentStatus.queueLength > 80 ||
        currentStatus.failureCount > 10
      );
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!show || !status) return null;

  const isCircuitOpen = status.circuitBreakerState === 'OPEN';
  const hasWarnings = status.failureCount > 0 || status.queueLength > 5;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className={`border-2 shadow-2xl ${
        isCircuitOpen 
          ? 'border-red-500 bg-red-50' 
          : hasWarnings 
            ? 'border-yellow-500 bg-yellow-50'
            : 'border-green-500 bg-green-50'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {isCircuitOpen ? (
              <Shield className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
            ) : hasWarnings ? (
              <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
            ) : (
              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
            )}
            
            <div className="flex-1 space-y-2">
              {isCircuitOpen && (
                <>
                  <h4 className="font-bold text-red-900">🚨 Sistema en Protección</h4>
                  <p className="text-sm text-red-800">
                    El sistema detectó demasiadas solicitudes simultáneas y activó el modo de protección.
                  </p>
                  <p className="text-xs text-red-700 font-mono">
                    ⏰ Disponible nuevamente: {status.circuitOpenUntil}
                  </p>
                  <p className="text-xs text-red-600 mt-2">
                    Por favor espera unos minutos antes de continuar. Las operaciones se reanudarán automáticamente.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 gap-1 border-red-300 text-red-700 hover:bg-red-100"
                    onClick={() => { resetCircuitBreaker(); setShow(false); }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Reanudar ahora
                  </Button>
                </>
              )}

              {!isCircuitOpen && hasWarnings && (
                <>
                  <h4 className="font-semibold text-yellow-900 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Sistema Bajo Carga
                  </h4>
                  <div className="text-xs text-yellow-800 space-y-1">
                    {status.queueLength > 0 && (
                      <p>• {status.queueLength} operaciones en cola</p>
                    )}
                    {status.failureCount > 0 && (
                      <p>• {status.failureCount} errores recientes</p>
                    )}
                  </div>
                  <p className="text-xs text-yellow-700 mt-2">
                    Las operaciones están siendo procesadas de forma ordenada para evitar sobrecarga.
                  </p>
                </>
              )}

              {!isCircuitOpen && !hasWarnings && (
                <>
                  <h4 className="font-semibold text-green-900">Sistema Estable</h4>
                  <p className="text-xs text-green-700">
                    Todas las operaciones están siendo procesadas normalmente.
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}