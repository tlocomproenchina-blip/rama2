import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Send, Calculator as CalcIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ShoppingAssistant() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="h-7 w-7 text-blue-600" />
            Asistente de Compras
          </h1>
          <p className="text-slate-600 mt-1 max-w-2xl">
            Te ayudamos a comprar en China de forma segura. Cuéntanos qué producto buscas, tu presupuesto y el enlace de la tienda, y te guiamos con la mejor opción de envío.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link to={createPageUrl('Support')}>
              <Send className="h-4 w-4 mr-2" /> Solicitar cotización
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={createPageUrl('ShippingCalculator')}>
              <CalcIcon className="h-4 w-4 mr-2" /> Calculadora de Envíos
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">1) Envíanos el producto</CardTitle>
            <CardDescription>Link del producto, variantes y cantidad</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Incluye imágenes o especificaciones si es necesario.
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">2) Te cotizamos</CardTitle>
            <CardDescription>Precio estimado + envío óptimo</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Elegimos entre aéreo o marítimo según tiempos y costos.
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">3) Compramos y gestionamos</CardTitle>
            <CardDescription>Seguimiento hasta entrega</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Te mantenemos informado del proceso completo.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}