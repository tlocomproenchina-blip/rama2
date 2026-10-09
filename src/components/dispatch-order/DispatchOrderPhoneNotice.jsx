import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, ArrowRight } from 'lucide-react';

// Aviso cuando todavía no hay número de WhatsApp del almacén guardado en Configuración.
export default function DispatchOrderPhoneNotice({ phone }) {
  if (phone) return null;

  return (
    <Card className="border-amber-200 bg-amber-50 shadow-card">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Guarda el número de WhatsApp del teléfono del almacén en Configuración para mandarle la orden en un
          clic. Mientras tanto puedes descargar el TXT o copiar el mensaje.
        </p>
        <Button asChild variant="outline" className="shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
          <Link to="/AdminSettings">
            Configurar número <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}