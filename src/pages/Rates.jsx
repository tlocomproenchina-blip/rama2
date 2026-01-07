import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Loader2,
  Plane,
  Ship,
  Package,
  ShieldCheck,
  DollarSign
} from 'lucide-react';

export default function Rates({ user }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
    if (configs.length > 0) {
      setConfig(configs[0]);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Tarifas de Envío</h1>
        <p className="text-slate-500">Conoce nuestras tarifas competitivas para tu carga</p>
      </div>

      {/* Shipping Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Air Shipping */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Plane className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Envío Aéreo</CardTitle>
                <CardDescription>Rápido y seguro</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-white rounded-xl border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-600">Carga General</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">
                    ${config?.rate_air_general?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-slate-500">por kilogramo</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Ideal para productos estándar: ropa, electrónicos, accesorios, etc.
              </p>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Carga Sensible</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-600">
                    ${config?.rate_air_sensitive?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-slate-500">por kilogramo</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Para artículos frágiles o de alto valor: perfumes, vidrio, joyería, etc.
              </p>
            </div>

            <div className="mt-4 p-3 bg-blue-50/50 rounded-lg">
              <p className="text-xs text-slate-600">
                ⏱️ <span className="font-medium">Tiempo estimado:</span> 7-15 días
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sea Shipping */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Ship className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Envío Marítimo</CardTitle>
                <CardDescription>Económico y confiable</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-white rounded-xl border border-indigo-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-600">Carga General</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-600">
                    ${config?.rate_sea_general?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-slate-500">por CBM</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Para grandes volúmenes: muebles, electrodomésticos, cajas múltiples.
              </p>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Carga Sensible</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-600">
                    ${config?.rate_sea_sensitive?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-slate-500">por CBM</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Carga frágil de gran volumen con manejo especial y cuidadoso.
              </p>
            </div>

            <div className="mt-4 p-3 bg-indigo-50/50 rounded-lg">
              <p className="text-xs text-slate-600">
                ⏱️ <span className="font-medium">Tiempo estimado:</span> 45-60 días
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insurance */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-50 to-teal-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Seguro de Carga</CardTitle>
              <CardDescription>Protege tu inversión</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-6 bg-white rounded-xl border border-emerald-100">
            <div>
              <p className="text-sm text-slate-600 mb-1">Cobertura completa sobre el valor FOB</p>
              <p className="text-xs text-slate-500">
                Protección contra daños, pérdidas o robos durante el transporte
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-emerald-600">
                {config?.insurance_percentage || 5}%
              </p>
              <p className="text-xs text-slate-500">del valor FOB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Info */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-600" />
            Información Adicional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex gap-2">
              <span className="font-semibold min-w-[140px]">Peso Volumétrico:</span>
              <span>Para envíos aéreos se calcula como (Largo × Ancho × Alto) / 6000</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold min-w-[140px]">CBM:</span>
              <span>Para envíos marítimos se calcula como (Largo × Ancho × Alto en metros)</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold min-w-[140px]">Costo Final:</span>
              <span>Se cobra según el peso facturable (el mayor entre peso real y volumétrico)</span>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold min-w-[140px]">Carga Sensible:</span>
              <span>Incluye manejo especial, empaque reforzado y seguimiento prioritario</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <CardContent className="p-8 text-center">
          <h3 className="text-2xl font-bold mb-2">¿Listo para enviar?</h3>
          <p className="text-blue-100 mb-4">
            Crea una pre-alerta y comienza a enviar tus productos de forma segura
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span>100% Seguro</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span>Seguimiento en tiempo real</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span>Precios competitivos</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}