import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, RefreshCw, Zap } from 'lucide-react';

/**
 * Rate Limit Message Component - 3 Premium Variants
 * 
 * Usage:
 * <RateLimitMessage 
 *   variant="minimal" // or "professional" or "friendly"
 *   waitMinutes={5}
 *   onRetry={() => console.log('Retry')}
 * />
 */

export default function RateLimitMessage({ 
  variant = 'minimal', 
  waitMinutes = 5,
  onRetry 
}) {
  const [countdown, setCountdown] = useState(waitMinutes * 60);
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setCanRetry(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRetry = () => {
    if (canRetry && onRetry) {
      onRetry();
    }
  };

  // VARIANT 1: MINIMAL (Ultra clean, tech-forward)
  if (variant === 'minimal') {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="border-0 shadow-2xl max-w-md w-full bg-gradient-to-br from-slate-50 to-white">
          <CardContent className="p-8 text-center space-y-6">
            <div className="inline-flex p-4 bg-blue-100 rounded-2xl">
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-slate-800">
                Por favor espera
              </h3>
              <p className="text-slate-600">
                Límite de solicitudes alcanzado
              </p>
            </div>

            <div className="py-4">
              <div className="text-5xl font-bold text-blue-600 font-mono">
                {formatTime(countdown)}
              </div>
              <p className="text-sm text-slate-500 mt-2">minutos restantes</p>
            </div>

            <Button
              onClick={handleRetry}
              disabled={!canRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              size="lg"
            >
              {canRetry ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reintentar
                </>
              ) : (
                'Esperando...'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // VARIANT 2: PROFESSIONAL (Enterprise-grade, detailed)
  if (variant === 'professional') {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="border border-amber-200 shadow-xl max-w-lg w-full">
          <CardContent className="p-8 space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 rounded-xl flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-slate-800 mb-2">
                  Límite Temporal de Solicitudes
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Para garantizar un servicio óptimo a todos nuestros usuarios, 
                  hemos implementado límites de solicitudes. Esta es una medida 
                  temporal de protección del sistema.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Tiempo de espera</p>
                  <p className="text-3xl font-bold text-slate-800 font-mono">
                    {formatTime(countdown)}
                  </p>
                </div>
                <Clock className="h-12 w-12 text-slate-300" />
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleRetry}
                disabled={!canRetry}
                className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                size="lg"
              >
                {canRetry ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reintentar Ahora
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Reintento disponible en {Math.ceil(countdown / 60)} min
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-slate-500">
                El botón se activará automáticamente cuando esté listo
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // VARIANT 3: FRIENDLY (Approachable, encouraging)
  if (variant === 'friendly') {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="border-0 shadow-2xl max-w-md w-full overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold">¡Momento! ✋</h3>
                <p className="text-purple-100 text-sm">Tomemos un pequeño respiro</p>
              </div>
            </div>
          </div>
          
          <CardContent className="p-6 space-y-6">
            <p className="text-slate-600 text-center">
              Has alcanzado el límite de solicitudes. Esto nos ayuda a mantener 
              todo funcionando rápido para todos. ✨
            </p>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 text-center border border-purple-100">
              <p className="text-sm text-purple-700 mb-2">Listo en</p>
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-mono">
                {formatTime(countdown)}
              </div>
            </div>

            <Button
              onClick={handleRetry}
              disabled={!canRetry}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white border-0"
              size="lg"
            >
              {canRetry ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  ¡Listo! Continuar
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-pulse" />
                  Preparándose...
                </>
              )}
            </Button>

            <p className="text-xs text-center text-slate-500">
              💡 Tip: Toma un café mientras tanto ☕
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

/**
 * EJEMPLOS DE USO:
 * 
 * // Variante 1: Minimal (tech-forward)
 * <RateLimitMessage 
 *   variant="minimal"
 *   waitMinutes={5}
 *   onRetry={() => window.location.reload()}
 * />
 * 
 * // Variante 2: Professional (enterprise)
 * <RateLimitMessage 
 *   variant="professional"
 *   waitMinutes={10}
 *   onRetry={() => navigate('/dashboard')}
 * />
 * 
 * // Variante 3: Friendly (casual)
 * <RateLimitMessage 
 *   variant="friendly"
 *   waitMinutes={3}
 *   onRetry={() => loadData()}
 * />
 */