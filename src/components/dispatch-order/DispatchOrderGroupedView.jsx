import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';
import DispatchOrderCityGroup from '@/components/dispatch-order/DispatchOrderCityGroup';

export default function DispatchOrderGroupedView({ sheet }) {
  const cities = sheet?.cities || [];

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4 text-primary" /> Qué buscar en almacén
        </CardTitle>
        <CardDescription>Agrupado por ciudad, shipping mark y N° de contenedor.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {cities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este contenedor no tiene bultos ni cajas.</p>
        ) : (
          cities.map((city) => <DispatchOrderCityGroup key={city.city} city={city} />)
        )}
      </CardContent>
    </Card>
  );
}