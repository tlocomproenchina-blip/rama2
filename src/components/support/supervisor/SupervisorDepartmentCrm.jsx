import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import useSupportDepartments from '@/hooks/useSupportDepartments';
import useSupportAdmins from '@/hooks/useSupportAdmins';
import useCrmInbox from '@/hooks/useCrmInbox';
import CrmDepartmentBoard from '@/components/support/crm/departments/CrmDepartmentBoard';
import SupervisorCaseFile from './SupervisorCaseFile';
import SupervisorMetrics from './SupervisorMetrics';
import SupervisorCaseTray from './SupervisorCaseTray';

// Módulo del supervisor: indicadores, bandeja con búsqueda y filtros, y el mismo
// tablero por departamento que ve el ATC. Al abrir un caso se gestiona completo.
export default function SupervisorDepartmentCrm({ user, initialTicketId = '' }) {
  const deps = useSupportDepartments(user);
  const admins = useSupportAdmins();
  const inbox = useCrmInbox();
  const [selected, setSelected] = useState(null);
  const [opening, setOpening] = useState(false);
  const [tab, setTab] = useState('bandeja');

  const openCase = async (_email, id) => {
    setOpening(true);
    try {
      setSelected(await base44.entities.SupportTicket.get(id));
    } catch {
      toast.error('No se pudo abrir el caso');
    }
    setOpening(false);
  };

  // Llegada desde la notificación: ?ticketId=... abre ese caso directamente.
  useEffect(() => {
    if (!initialTicketId) return;
    base44.entities.SupportTicket.get(initialTicketId)
      .then((ticket) => ticket && setSelected(ticket))
      .catch(() => toast.error('No se encontró el caso'));
  }, [initialTicketId]);

  if (selected) {
    return (
      <SupervisorCaseFile
        ticket={selected}
        user={user}
        onBack={() => { setSelected(null); inbox.reload(); }}
        onChange={(updated) => setSelected(updated)}
      />
    );
  }

  if ((inbox.loading && !inbox.data) || deps.loading) {
    return <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando casos…</p>;
  }

  if (!inbox.data) {
    return (
      <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
        No se pudieron cargar los casos.
        <Button size="sm" variant="outline" onClick={inbox.reload}>Reintentar</Button>
      </div>
    );
  }

  const cases = inbox.data.cases || [];

  return (
    <div className="space-y-5">
      <SupervisorMetrics cases={cases} departments={deps.departments} />
      <Tabs value={tab} onValueChange={setTab} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="bandeja">Bandeja de casos</TabsTrigger>
            <TabsTrigger value="departamentos">Por departamento</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {opening && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button size="sm" variant="ghost" onClick={inbox.reload} disabled={inbox.loading}>
              <RefreshCw className={`h-4 w-4 ${inbox.loading ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
          </div>
        </div>
        <TabsContent value="bandeja">
          <SupervisorCaseTray cases={cases} profiles={inbox.data.profiles} departments={deps.departments} admins={admins} onOpen={openCase} />
        </TabsContent>
        <TabsContent value="departamentos">
          <CrmDepartmentBoard
            cases={cases}
            profiles={inbox.data.profiles}
            deps={deps}
            onMove={(id, dep) => inbox.moveCase(id, dep, user)}
            onOpen={openCase}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}