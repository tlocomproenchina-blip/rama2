import React from 'react';
import { Link } from 'react-router-dom';
import { Headphones, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHero from '@/components/common/PageHero';
import SupervisorEscalationsPanel from '@/components/support/supervisor/SupervisorEscalationsPanel';
import PackageEditReviewPanel from '@/components/support/supervisor/PackageEditReviewPanel';
import SupervisorDepartmentCrm from '@/components/support/supervisor/SupervisorDepartmentCrm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Módulo del supervisor: los casos que el ATC escaló, con su expediente completo
// (chat previo, adjuntos, datos y todo el historial del cliente) en una pantalla.
export default function AdminSupportSupervisor({ user }) {
  const focusTicketId = new URLSearchParams(window.location.search).get('ticketId') || '';

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-3 pb-16 pt-4 sm:px-5">
      <PageHero
        icon={ShieldCheck}
        badge="Área Soporte · Supervisor"
        title="Módulo del supervisor"
        description="Casos que el ATC escaló, pendientes primero. Ábrelos para responder en el chat del caso, adjuntar fotos, PDF y documentos, dejar notas internas y revisar todo el historial del cliente sin salir de esta pantalla."
        actions={
          <Button asChild variant="outline">
            <Link to="/AdminSupportAssistant">
              <Headphones className="mr-1.5 h-4 w-4" /> Ir al Asistente ATC
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="bandeja">
        <TabsList>
          <TabsTrigger value="bandeja">Bandeja de casos</TabsTrigger>
          <TabsTrigger value="departamentos">CRM por departamento</TabsTrigger>
        </TabsList>
        <TabsContent value="bandeja">
          <SupervisorEscalationsPanel user={user} initialTicketId={focusTicketId} />
        </TabsContent>
        <TabsContent value="departamentos">
          <SupervisorDepartmentCrm user={user} />
        </TabsContent>
      </Tabs>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Cambios de paquete enviados por el ATC</h2>
          <p className="text-sm text-muted-foreground">
            Tracking, monto del seguro, fecha de despacho e imágenes que Soporte corrigió desde el asistente o desde la ficha del cliente, pendientes de revisión.
          </p>
        </div>
        <PackageEditReviewPanel user={user} />
      </section>
    </div>
  );
}