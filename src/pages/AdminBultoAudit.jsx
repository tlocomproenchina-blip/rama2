import React from 'react';
import { History } from 'lucide-react';
import PageHero from '@/components/common/PageHero';
import BultoAuditPanel from '@/components/admin/bulto-audit/BultoAuditPanel';

// Auditoría de bultos: el panel vive en BultoAuditPanel y se muestra igual desde
// esta página y desde la pestaña "Auditoría de Bultos" de Etiquetas de Despacho.
export default function AdminBultoAudit() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHero
        icon={History}
        badge="Auditoría de bultos"
        title="Historial de escaneos"
        description="Registro completo de qué empleado procesó cada bulto y a qué hora, con los paquetes incluidos."
      />

      <BultoAuditPanel />
    </div>
  );
}